/**
 * Scheduler.ts — Intelligent context-aware scheduler
 *
 * Responsibilities:
 * - Dependency resolution
 * - Parallel vs sequential execution ordering
 * - Resource conflict checking via ResourceLockManager
 * - Context availability verification
 * - Deadlock prevention
 */

import { ActionGraph, ActionNode } from '../../actions/models/ActionTypes';
import { NodeState, IResourceLockManager } from '../models/RuntimeTypes';
import { ExecutionContext } from '../state/ExecutionContext';
import { ExecutionQueue } from '../queue/ExecutionQueue';
import { RuntimeTelemetry } from '../telemetry/RuntimeTelemetry';

export class Scheduler {
  constructor(
    private lockManager: IResourceLockManager,
    private telemetry?: RuntimeTelemetry
  ) {}

  /**
   * Enqueues initial actions into the ExecutionQueue based on graph tiers and priorities.
   */
  public scheduleGraph(graph: ActionGraph, queue: ExecutionQueue): void {
    this.telemetry?.depResolutionBegin();
    try {
      // Assign priority based on topological ordering (earlier in order = higher priority / lower number)
      graph.executionOrder.forEach((id, idx) => {
        const node = graph.nodes.find(n => n.id === id);
        if (node) {
          queue.enqueue(node, idx);
        }
      });
    } finally {
      this.telemetry?.depResolutionEnd();
    }
  }

  /**
   * Dequeues the next batch of nodes that are eligible to execute immediately and in parallel.
   * Checks dependency states, resource conflicts, and context availability.
   */
  public getNextBatch(
    queue: ExecutionQueue,
    nodeStates: Record<string, NodeState>,
    context: ExecutionContext
  ): ActionNode[] {
    this.telemetry?.depResolutionBegin();
    try {
      const eligibleNodes = queue.peekEligible(nodeStates);
      const readyBatch: ActionNode[] = [];

      for (const node of eligibleNodes) {
        // 1. Verify required context outputs from dependencies
        let contextReady = true;
        for (const depId of node.dependencies) {
          const depOutputs = context.getNodeOutputs(depId);
          // If dependency produced outputs, ensure they are available in context
          if (!depOutputs && nodeStates[depId] !== 'completed') {
            contextReady = false;
            break;
          }
        }
        if (!contextReady) continue;

        // 2. Check for resource conflicts and acquire locks if needed
        let canAcquireLocks = true;
        const acquiredResources: { type: any; id: string }[] = [];

        // Simple resource locking rule: lock based on inputs if they refer to resources (paths, apps, pids)
        if (node.inputs['file'] && typeof node.inputs['file'] === 'string') {
          if (this.lockManager.acquire('file', node.inputs['file'], node.id)) {
            acquiredResources.push({ type: 'file', id: node.inputs['file'] });
          } else {
            canAcquireLocks = false;
          }
        } else if (node.inputs['application'] && typeof node.inputs['application'] === 'string') {
          if (this.lockManager.acquire('application', node.inputs['application'], node.id)) {
            acquiredResources.push({ type: 'application', id: node.inputs['application'] });
          } else {
            canAcquireLocks = false;
          }
        }

        if (!canAcquireLocks) {
          // Rollback locks acquired in this check
          for (const res of acquiredResources) {
            this.lockManager.release(res.type, res.id, node.id);
          }
          continue; // Postpone node until resource is free
        }

        // Node is fully ready to execute!
        queue.remove(node.id);
        readyBatch.push(node);

        // If node is not parallelizable with others in this batch, stop adding more to the batch
        if (!node.parallelizable && readyBatch.length > 0) {
          if (readyBatch.length === 1) {
            // Only this node in the batch; stop collecting more
            break;
          } else {
            // There were already nodes in the batch, defer this sequential node until next turn
            readyBatch.pop();
            for (const res of acquiredResources) {
              this.lockManager.release(res.type, res.id, node.id);
            }
            queue.enqueue(node, 0); // Put back with high priority
            break;
          }
        }
      }

      if (readyBatch.length > 1) {
        readyBatch.forEach(() => this.telemetry?.recordParallelNode());
      }

      return readyBatch;
    } finally {
      this.telemetry?.depResolutionEnd();
    }
  }

  /**
   * Checks if the execution graph is in a deadlock.
   * Deadlock occurs when queue is not empty, no nodes are running, and no nodes can be dequeued.
   */
  public isDeadlocked(
    queue: ExecutionQueue,
    nodeStates: Record<string, NodeState>,
    runningCount: number
  ): boolean {
    if (queue.isEmpty() || runningCount > 0) return false;
    
    // If no nodes are running and nothing is eligible in the queue, we are deadlocked
    const eligible = queue.peekEligible(nodeStates);
    return eligible.length === 0;
  }
}
