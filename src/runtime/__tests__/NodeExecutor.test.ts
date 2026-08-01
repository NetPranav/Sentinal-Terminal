import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeExecutor, MockExecutor } from '../executor/NodeExecutor';
import { RuntimeEventBus } from '../events/RuntimeEventBus';
import { ActionStateMachine } from '../state/ActionStateMachine';
import { ResourceLockManager } from '../queue/ResourceLockManager';
import { ExecutionContext } from '../state/ExecutionContext';
import { createMockActionNode } from './helpers';

describe('NodeExecutor', () => {
  let mockExecutor: MockExecutor;
  let eventBus: RuntimeEventBus;
  let stateMachine: ActionStateMachine;
  let lockManager: ResourceLockManager;
  let executor: NodeExecutor;
  let context: ExecutionContext;

  beforeEach(() => {
    mockExecutor = new MockExecutor();
    eventBus = new RuntimeEventBus();
    stateMachine = new ActionStateMachine();
    lockManager = new ResourceLockManager();
    executor = new NodeExecutor(mockExecutor, eventBus, stateMachine, lockManager);
    context = new ExecutionContext();
  });

  it('should execute successfully and publish outputs to ExecutionContext', async () => {
    const node = createMockActionNode('node-1', 'test.out');
    node.action.outcomes = [{ id: 'status', description: 'result', stateKey: 'status', stateValue: 'active' }];

    stateMachine.initialize('node-1');
    stateMachine.transition('node-1', 'queued');
    stateMachine.transition('node-1', 'waiting');

    const res = await executor.execute(node, 'sess-1', context);
    expect(res.success).toBe(true);
    expect(stateMachine.getState('node-1')).toBe('completed');
    expect(context.getOutput('node-1', 'status')).toBe('active');
  });

  it('should retry according to action retry policy on failure', async () => {
    const node = createMockActionNode('node-2', 'retry.action');
    node.action.retryPolicy = { maxRetries: 2, delayMs: 10, exponentialBackoff: false };

    let attempts = 0;
    mockExecutor.setHandler('retry.action', async () => {
      attempts++;
      if (attempts <= 2) throw new Error('Simulated network fail');
      return { actionNodeId: node.id, success: true, outputs: { recovered: true }, latencyMs: 5 };
    });

    stateMachine.initialize('node-2');
    stateMachine.transition('node-2', 'queued');
    stateMachine.transition('node-2', 'waiting');

    const res = await executor.execute(node, 'sess-1', context);
    expect(attempts).toBe(3);
    expect(res.success).toBe(true);
    expect(res.outputs.recovered).toBe(true);
  });

  it('should transition to timed_out state when execution exceeds timeoutMs', async () => {
    const node = createMockActionNode('node-3', 'slow.action');
    node.action.timeoutMs = 50;
    node.action.retryPolicy = { maxRetries: 0, delayMs: 1, exponentialBackoff: false };

    mockExecutor.setHandler('slow.action', async () => {
      await new Promise(r => setTimeout(r, 200));
      return { actionNodeId: node.id, success: true, outputs: {}, latencyMs: 200 };
    });

    stateMachine.initialize('node-3');
    stateMachine.transition('node-3', 'queued');
    stateMachine.transition('node-3', 'waiting');

    const res = await executor.execute(node, 'sess-1', context);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Execution timed out');
    expect(stateMachine.getState('node-3')).toBe('timed_out');
  });
});
