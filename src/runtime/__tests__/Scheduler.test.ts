import { describe, it, expect, beforeEach } from 'vitest';
import { Scheduler } from '../scheduler/Scheduler';
import { ResourceLockManager } from '../queue/ResourceLockManager';
import { ExecutionQueue } from '../queue/ExecutionQueue';
import { ExecutionContext } from '../state/ExecutionContext';
import { createMockActionNode, createMockActionGraph } from './helpers';

describe('Scheduler', () => {
  let lockManager: ResourceLockManager;
  let scheduler: Scheduler;
  let queue: ExecutionQueue;
  let context: ExecutionContext;

  beforeEach(() => {
    lockManager = new ResourceLockManager();
    scheduler = new Scheduler(lockManager);
    queue = new ExecutionQueue();
    context = new ExecutionContext();
  });

  it('should schedule graph nodes into queue based on topological execution order', () => {
    const nodeA = createMockActionNode('A');
    const nodeB = createMockActionNode('B', 'test.action', ['A']);
    const graph = createMockActionGraph([nodeA, nodeB]);
    graph.executionOrder = ['A', 'B'];

    scheduler.scheduleGraph(graph, queue);
    expect(queue.size()).toBe(2);
  });

  it('should batch independent parallelizable nodes together', () => {
    const node1 = createMockActionNode('1', 'app.open');
    const node2 = createMockActionNode('2', 'app.open');
    queue.enqueue(node1);
    queue.enqueue(node2);

    const batch = scheduler.getNextBatch(queue, { '1': 'queued', '2': 'queued' }, context);
    expect(batch).toHaveLength(2);
    expect(queue.isEmpty()).toBe(true);
  });

  it('should prevent parallel execution of nodes with resource lock conflicts', () => {
    // Both nodes attempt to act on the same file path
    const node1 = createMockActionNode('1', 'fs.write', [], { inputs: { file: '/shared.doc' }, parallelizable: true });
    const node2 = createMockActionNode('2', 'fs.read', [], { inputs: { file: '/shared.doc' }, parallelizable: true });

    queue.enqueue(node1);
    queue.enqueue(node2);

    const batch = scheduler.getNextBatch(queue, { '1': 'queued', '2': 'queued' }, context);
    expect(batch).toHaveLength(1);
    expect(batch[0].id).toBe('1');
    expect(queue.size()).toBe(1); // Node 2 deferred due to lock conflict
  });

  it('should correctly detect deadlock conditions', () => {
    const nodeA = createMockActionNode('A', 'test.action', ['B']);
    const nodeB = createMockActionNode('B', 'test.action', ['A']);
    queue.enqueue(nodeA);
    queue.enqueue(nodeB);

    const nodeStates = { 'A': 'queued', 'B': 'queued' } as any;
    expect(scheduler.isDeadlocked(queue, nodeStates, 0)).toBe(true);
    expect(scheduler.isDeadlocked(queue, nodeStates, 1)).toBe(false); // Task running could resolve dependency
  });
});
