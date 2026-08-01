/**
 * ExecutionSession.ts — Encapsulates an executing session and all its state
 *
 * Every user request creates an ExecutionSession.
 * Owns its shared ExecutionContext, State Machine, Queue, Lock Manager, and Telemetry.
 * Supports progress tracking, cancellation, and serialization (export/restore).
 */

import { ActionGraph, ActionResult, ActionExecutor } from '../../actions/models/ActionTypes';
import { SessionStatus, SessionProgress, SessionSnapshot } from '../models/RuntimeTypes';
import { ExecutionContext } from '../state/ExecutionContext';
import { ActionStateMachine } from '../state/ActionStateMachine';
import { ExecutionQueue } from '../queue/ExecutionQueue';
import { ResourceLockManager } from '../queue/ResourceLockManager';
import { RuntimeTelemetry } from '../telemetry/RuntimeTelemetry';
import { RuntimeEventBus } from '../events/RuntimeEventBus';
import { RuntimeHooks } from '../lifecycle/RuntimeHooks';
import { Scheduler } from '../scheduler/Scheduler';
import { NodeExecutor } from '../executor/NodeExecutor';
import { RecoveryManager } from '../recovery/RecoveryManager';
import { randomUUID } from 'crypto';

export class ExecutionSession {
  public readonly sessionId: string;
  public status: SessionStatus;
  public readonly createdAt: number;
  public readonly context: ExecutionContext;
  public readonly stateMachine: ActionStateMachine;
  public readonly queue: ExecutionQueue;
  public readonly lockManager: ResourceLockManager;
  public readonly telemetry: RuntimeTelemetry;
  public readonly scheduler: Scheduler;
  public readonly recoveryManager: RecoveryManager;
  public readonly nodeExecutor: NodeExecutor;
  
  private results: ActionResult[] = [];
  private isPaused = false;
  private isCancelled = false;
  private runningPromise: Promise<ActionResult[]> | null = null;
  private resumeCallback: (() => void) | null = null;

  constructor(
    public readonly graph: ActionGraph,
    public readonly eventBus: RuntimeEventBus,
    public readonly hooks: RuntimeHooks,
    executor: ActionExecutor,
    sessionId?: string
  ) {
    this.sessionId = sessionId || randomUUID();
    this.status = 'created';
    this.createdAt = Date.now();
    this.context = new ExecutionContext();
    this.stateMachine = new ActionStateMachine();
    this.queue = new ExecutionQueue();
    this.lockManager = new ResourceLockManager();
    this.telemetry = new RuntimeTelemetry();
    this.scheduler = new Scheduler(this.lockManager, this.telemetry);
    this.recoveryManager = new RecoveryManager(this.stateMachine, this.eventBus, this.hooks);
    this.nodeExecutor = new NodeExecutor(executor, this.eventBus, this.stateMachine, this.lockManager, this.hooks, this.telemetry);

    // Initialize state machine for all nodes in graph
    for (const node of this.graph.nodes) {
      this.stateMachine.initialize(node.id);
    }
  }

  /**
   * Run or resume execution of the graph.
   */
  public async execute(): Promise<ActionResult[]> {
    if (this.status === 'running') {
      return this.runningPromise || Promise.resolve(this.results);
    }

    this.status = 'running';
    this.telemetry.sessionStart();
    const startEvent = this.eventBus.emit('session_started', this.sessionId, { nodeCount: this.graph.nodes.length });
    await this.hooks.invoke('before_session_start', startEvent);

    this.runningPromise = this.runLoop();
    return this.runningPromise;
  }

  private async runLoop(): Promise<ActionResult[]> {
    // Enqueue nodes into ExecutionQueue
    this.scheduler.scheduleGraph(this.graph, this.queue);
    for (const node of this.graph.nodes) {
      if (this.stateMachine.canTransition(node.id, 'queued')) {
        this.stateMachine.transition(node.id, 'queued');
        this.eventBus.emit('action_queued', this.sessionId, {}, node.id);
        this.telemetry.nodeQueued(node.id);
      }
    }

    const activeTasks: Map<string, Promise<ActionResult>> = new Map();

    while (!this.queue.isEmpty() || activeTasks.size > 0) {
      // Check cancellation
      if (this.isCancelled) {
        this.status = 'cancelled';
        for (const [nodeId] of activeTasks) {
          if (this.stateMachine.canTransition(nodeId, 'cancelled')) {
            this.stateMachine.transition(nodeId, 'cancelled');
          }
        }
        this.queue.clear();
        break;
      }

      // Check pause state
      if (this.isPaused) {
        this.status = 'paused';
        this.eventBus.emit('session_paused', this.sessionId);
        await new Promise<void>(resolve => { this.resumeCallback = resolve; });
        if (this.isCancelled) continue;
        this.status = 'running';
        this.eventBus.emit('session_resumed', this.sessionId);
      }

      // Get next batch of eligible parallel tasks
      const nodeStates = this.stateMachine.exportStates();
      const nextBatch = this.scheduler.getNextBatch(this.queue, nodeStates, this.context);

      for (const node of nextBatch) {
        if (this.stateMachine.canTransition(node.id, 'waiting')) {
          this.stateMachine.transition(node.id, 'waiting');
          this.eventBus.emit('action_waiting', this.sessionId, {}, node.id);
        }

        const promise = this.nodeExecutor.execute(node, this.sessionId, this.context)
          .then(async (result) => {
            activeTasks.delete(node.id);
            this.results.push(result);
            if (!result.success) {
              const { shouldHaltGraph } = await this.recoveryManager.handleNodeFailure(
                node.id, this.graph, this.sessionId, result.error || 'Unknown error'
              );
              if (shouldHaltGraph && !this.queue.isEmpty()) {
                this.queue.clear();
              }
            }
            return result;
          });
        activeTasks.set(node.id, promise);
      }

      // If no new tasks could be scheduled and tasks are running, wait for at least one to complete
      if (activeTasks.size > 0 && nextBatch.length === 0) {
        // Deadlock check
        if (this.scheduler.isDeadlocked(this.queue, this.stateMachine.exportStates(), activeTasks.size)) {
          this.status = 'failed';
          this.eventBus.emit('session_failed', this.sessionId, { error: 'Execution deadlocked' });
          break;
        }
        await Promise.race(activeTasks.values());
      } else if (activeTasks.size === 0 && !this.queue.isEmpty() && nextBatch.length === 0) {
        // Nothing running, queue not empty, but nothing eligible -> dependency error or unresolved output
        this.status = 'failed';
        this.eventBus.emit('session_failed', this.sessionId, { error: 'Unsatisfied dependencies or resource locks in queue' });
        break;
      }
    }

    if (this.status === 'running') {
      const allSuccess = this.results.every(r => r.success);
      this.status = allSuccess ? 'completed' : 'failed';
      const eventType = allSuccess ? 'session_completed' : 'session_failed';
      const finishEvent = this.eventBus.emit(eventType, this.sessionId, { results: this.results, metrics: this.telemetry.getMetrics() });
      await this.hooks.invoke('after_session_finish', finishEvent);
    } else if (this.status === 'cancelled') {
      const cancelEvent = this.eventBus.emit('session_cancelled', this.sessionId, { results: this.results });
      await this.hooks.invoke('after_session_finish', cancelEvent);
    }

    return this.results;
  }

  /**
   * Pause execution session.
   */
  public pause(): void {
    if (this.status === 'running') {
      this.isPaused = true;
    }
  }

  /**
   * Resume paused session.
   */
  public resume(): void {
    if (this.isPaused && this.resumeCallback) {
      this.isPaused = false;
      const callback = this.resumeCallback;
      this.resumeCallback = null;
      callback();
    }
  }

  /**
   * Cancel entire execution session or an individual action node.
   */
  public async cancel(actionNodeId?: string): Promise<void> {
    if (actionNodeId) {
      if (this.queue.remove(actionNodeId)) {
        if (this.stateMachine.canTransition(actionNodeId, 'cancelled')) {
          this.stateMachine.transition(actionNodeId, 'cancelled');
          const cancelEvent = this.eventBus.emit('action_cancelled', this.sessionId, { reason: 'User cancelled node' }, actionNodeId);
          await this.hooks.invoke('on_cancellation', cancelEvent);
          await this.recoveryManager.handleNodeFailure(actionNodeId, this.graph, this.sessionId, 'Cancelled by user');
        }
      }
    } else {
      this.isCancelled = true;
      if (this.isPaused && this.resumeCallback) {
        this.resume(); // Wake up loop to handle cancellation cleanly
      }
    }
  }

  /**
   * Get live progress tracking data.
   */
  public getProgress(): SessionProgress {
    const states = this.stateMachine.exportStates();
    const totalNodes = this.graph.nodes.length;
    let completedNodes = 0;
    let runningNodes = 0;
    let failedNodes = 0;
    let cancelledNodes = 0;
    let currentAction: string | undefined;

    for (const [nodeId, state] of Object.entries(states)) {
      if (state === 'completed') completedNodes++;
      else if (state === 'running') {
        runningNodes++;
        const node = this.graph.nodes.find(n => n.id === nodeId);
        if (node) currentAction = node.goalNode.title || node.action.displayName;
      }
      else if (state === 'failed' || state === 'timed_out') failedNodes++;
      else if (state === 'cancelled') cancelledNodes++;
    }

    const percentage = totalNodes > 0 ? Math.floor(((completedNodes + failedNodes + cancelledNodes) / totalNodes) * 100) : 100;
    const metrics = this.telemetry.getMetrics();
    const elapsedMs = metrics.totalDurationMs;
    const estimatedRemainingMs = completedNodes > 0
      ? ((elapsedMs / completedNodes) * (totalNodes - completedNodes))
      : 0;

    return {
      percentage,
      totalNodes,
      completedNodes,
      runningNodes,
      failedNodes,
      cancelledNodes,
      elapsedMs,
      estimatedRemainingMs,
      currentAction,
    };
  }

  /**
   * Serialize session to snapshot for pause/save/restore.
   */
  public export(): SessionSnapshot {
    return {
      sessionId: this.sessionId,
      status: this.status,
      createdAt: this.createdAt,
      nodeStates: this.stateMachine.exportStates(),
      context: this.context.export(),
      events: this.eventBus.getHistory(this.sessionId),
      results: [...this.results],
      exportedAt: Date.now(),
    };
  }

  /**
   * Restore session state from snapshot.
   */
  public restore(snapshot: SessionSnapshot): void {
    if (snapshot.sessionId !== this.sessionId) {
      throw new Error(`Cannot restore snapshot of session '${snapshot.sessionId}' into session '${this.sessionId}'`);
    }
    this.status = snapshot.status;
    this.stateMachine.restoreStates(snapshot.nodeStates);
    this.context.restore(snapshot.context);
    this.results = [...snapshot.results];
    // Clear queue and re-enqueue any incomplete tasks
    this.queue.clear();
    if (this.status === 'paused' || this.status === 'running') {
      this.isPaused = this.status === 'paused';
      for (const node of this.graph.nodes) {
        const s = this.stateMachine.getState(node.id);
        if (s === 'created' || s === 'queued' || s === 'waiting') {
          this.queue.enqueue(node);
        }
      }
    }
  }
}
