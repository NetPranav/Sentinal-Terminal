/**
 * NodeExecutor.ts — Executes ActionNodes with timeout, retries, and context publishing
 *
 * Enforces action retry policy and timeout.
 * Emits execution events and publishes outputs to the ExecutionContext.
 */

import { ActionNode, ActionResult, ActionExecutor } from '../../actions/models/ActionTypes';
import { ExecutionContext } from '../state/ExecutionContext';
import { RuntimeEventBus } from '../events/RuntimeEventBus';
import { RuntimeHooks } from '../lifecycle/RuntimeHooks';
import { RuntimeTelemetry } from '../telemetry/RuntimeTelemetry';
import { ActionStateMachine } from '../state/ActionStateMachine';
import { IResourceLockManager } from '../models/RuntimeTypes';

export class NodeExecutor {
  constructor(
    private executor: ActionExecutor,
    private eventBus: RuntimeEventBus,
    private stateMachine: ActionStateMachine,
    private lockManager: IResourceLockManager,
    private hooks?: RuntimeHooks,
    private telemetry?: RuntimeTelemetry
  ) {}

  /**
   * Execute an ActionNode, respecting timeouts and retries, and update context upon completion.
   */
  public async execute(
    node: ActionNode,
    sessionId: string,
    context: ExecutionContext
  ): Promise<ActionResult> {
    const policy = node.action.retryPolicy || { maxRetries: 1, delayMs: 100, exponentialBackoff: false };
    let attempt = 0;
    let delay = policy.delayMs;

    this.stateMachine.transition(node.id, 'running');
    const startEvent = this.eventBus.emit('action_started', sessionId, { inputs: node.inputs }, node.id);
    await this.hooks?.invoke('before_action_execute', startEvent);
    this.telemetry?.nodeStarted(node.id);

    while (attempt <= policy.maxRetries) {
      attempt++;
      const startTime = performance.now();

      try {
        // Execute with timeout enforcement
        const result = await this.executeWithTimeout(node);
        const latencyMs = performance.now() - startTime;
        result.latencyMs = latencyMs;

        if (result.success) {
          this.stateMachine.transition(node.id, 'completed');
          
          // Publish outputs to ExecutionContext
          if (result.outputs) {
            for (const [key, value] of Object.entries(result.outputs)) {
              context.setOutput(node.id, key, value);
            }
          }

          const completeEvent = this.eventBus.emit('action_completed', sessionId, { outputs: result.outputs, latencyMs }, node.id);
          await this.hooks?.invoke('after_action_execute', completeEvent);
          this.telemetry?.nodeCompleted(node.id);
          this.lockManager.releaseAll(node.id);
          return result;
        } else {
          throw new Error(result.error || 'Execution failed');
        }
      } catch (err: any) {
        const isTimeout = err.message === 'Execution timed out';
        
        if (isTimeout) {
          this.telemetry?.recordTimeout();
          if (attempt > policy.maxRetries) {
            this.stateMachine.transition(node.id, 'timed_out');
            const timeoutEvent = this.eventBus.emit('action_timed_out', sessionId, { error: err.message }, node.id);
            await this.hooks?.invoke('on_failure', timeoutEvent);
            this.lockManager.releaseAll(node.id);
            return { actionNodeId: node.id, success: false, outputs: {}, error: err.message, latencyMs: performance.now() - startTime };
          }
        }

        if (attempt <= policy.maxRetries) {
          this.telemetry?.recordRetry();
          const retryEvent = this.eventBus.emit('action_retried', sessionId, { attempt, maxRetries: policy.maxRetries, error: err.message }, node.id);
          await this.hooks?.invoke('before_retry', retryEvent);
          await new Promise(resolve => setTimeout(resolve, delay));
          if (policy.exponentialBackoff) delay *= 2;
          const afterRetryEvent = this.eventBus.emit('action_retried', sessionId, { nextAttempt: attempt + 1 }, node.id);
          await this.hooks?.invoke('after_retry', afterRetryEvent);
        } else {
          this.stateMachine.transition(node.id, 'failed');
          const failEvent = this.eventBus.emit('action_failed', sessionId, { error: err.message }, node.id);
          await this.hooks?.invoke('on_failure', failEvent);
          this.lockManager.releaseAll(node.id);
          return { actionNodeId: node.id, success: false, outputs: {}, error: err.message, latencyMs: performance.now() - startTime };
        }
      }
    }

    // Should never reach here, but TypeScript requires a return
    this.lockManager.releaseAll(node.id);
    return { actionNodeId: node.id, success: false, outputs: {}, error: 'Max retries exceeded', latencyMs: 0 };
  }

  private async executeWithTimeout(node: ActionNode): Promise<ActionResult> {
    const timeoutMs = node.action.timeoutMs || 30000;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Execution timed out'));
      }, timeoutMs);

      this.executor.execute(node)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}

/**
 * MockExecutor — Dummy executor for Phase 4 tests and dry-run simulations.
 * No real operating system API or shell commands are invoked.
 */
export class MockExecutor implements ActionExecutor {
  private customHandlers: Map<string, (node: ActionNode) => Promise<ActionResult>> = new Map();

  public setHandler(actionId: string, handler: (node: ActionNode) => Promise<ActionResult>): void {
    this.customHandlers.set(actionId, handler);
  }

  public async execute(node: ActionNode): Promise<ActionResult> {
    const handler = this.customHandlers.get(node.action.id);
    if (handler) {
      return handler(node);
    }

    // Simulate basic delay if specified in inputs, or return mock outputs
    const mockOutput: Record<string, unknown> = { executed: true, nodeTitle: node.goalNode.title };
    if (node.action.outcomes && node.action.outcomes.length > 0) {
      for (const out of node.action.outcomes) {
        mockOutput[out.id] = out.stateValue;
      }
    }

    return {
      actionNodeId: node.id,
      success: true,
      outputs: mockOutput,
      latencyMs: 10
    };
  }
}
