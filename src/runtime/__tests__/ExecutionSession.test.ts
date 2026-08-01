import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionSession } from '../sessions/ExecutionSession';
import { RuntimeEventBus } from '../events/RuntimeEventBus';
import { RuntimeHooks } from '../lifecycle/RuntimeHooks';
import { MockExecutor } from '../executor/NodeExecutor';
import { createMockActionNode, createMockActionGraph } from './helpers';

describe('ExecutionSession', () => {
  let eventBus: RuntimeEventBus;
  let hooks: RuntimeHooks;
  let executor: MockExecutor;

  beforeEach(() => {
    eventBus = new RuntimeEventBus();
    hooks = new RuntimeHooks();
    executor = new MockExecutor();
  });

  it('should execute simple sequential actions to completion', async () => {
    const nodeA = createMockActionNode('1', 'app.open', []);
    const nodeB = createMockActionNode('2', 'app.focus', ['1']);
    const graph = createMockActionGraph([nodeA, nodeB]);
    graph.executionOrder = ['1', '2'];

    const session = new ExecutionSession(graph, eventBus, hooks, executor);
    expect(session.status).toBe('created');

    const results = await session.execute();
    expect(results).toHaveLength(2);
    expect(session.status).toBe('completed');
    expect(session.getProgress().percentage).toBe(100);
  });

  it('should execute independent nodes simultaneously in parallel', async () => {
    const n1 = createMockActionNode('a', 'open.chrome');
    const n2 = createMockActionNode('b', 'open.cursor');
    const n3 = createMockActionNode('c', 'open.terminal');
    const graph = createMockActionGraph([n1, n2, n3]);

    const session = new ExecutionSession(graph, eventBus, hooks, executor);
    const results = await session.execute();

    expect(results).toHaveLength(3);
    expect(session.status).toBe('completed');
  });

  it('should support pausing and resuming execution', async () => {
    const n1 = createMockActionNode('1');
    const n2 = createMockActionNode('2', 'test', ['1']);
    const graph = createMockActionGraph([n1, n2]);

    executor.setHandler('test', async () => {
      await new Promise(r => setTimeout(r, 20));
      return { actionNodeId: '2', success: true, outputs: {}, latencyMs: 20 };
    });

    const session = new ExecutionSession(graph, eventBus, hooks, executor);
    
    // Start execution and quickly pause
    const execPromise = session.execute();
    session.pause();

    // After a bit, resume
    setTimeout(() => {
      session.resume();
    }, 50);

    const res = await execPromise;
    expect(res).toHaveLength(2);
    expect(session.status).toBe('completed');
  });

  it('should support cancellation and prevent remaining nodes from executing', async () => {
    const n1 = createMockActionNode('1');
    const n2 = createMockActionNode('2', 'test', ['1']);
    const graph = createMockActionGraph([n1, n2]);

    executor.setHandler(n1.action.id, async (node) => {
      await new Promise(r => setTimeout(r, 40));
      return { actionNodeId: node.id, success: true, outputs: {}, latencyMs: 40 };
    });

    const session = new ExecutionSession(graph, eventBus, hooks, executor);
    const promise = session.execute();

    setTimeout(() => {
      session.cancel();
    }, 10);

    const res = await promise;
    expect(session.status).toBe('cancelled');
  });
});
