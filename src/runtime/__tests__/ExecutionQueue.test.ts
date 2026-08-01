import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionQueue } from '../queue/ExecutionQueue';
import { createMockActionNode } from './helpers';

describe('ExecutionQueue', () => {
  let queue: ExecutionQueue;

  beforeEach(() => {
    queue = new ExecutionQueue();
  });

  it('should dequeue based on priority ordering when dependencies are satisfied', () => {
    const nodeA = createMockActionNode('A', 'app.open', [], { title: 'Low Priority' } as any);
    const nodeB = createMockActionNode('B', 'app.close', [], { title: 'High Priority' } as any);

    queue.enqueue(nodeA, 10);
    queue.enqueue(nodeB, 1); // higher priority

    const first = queue.dequeueEligible({});
    expect(first?.id).toBe('B');
    const second = queue.dequeueEligible({});
    expect(second?.id).toBe('A');
  });

  it('should not dequeue nodes with unsatisfied dependencies', () => {
    const depNode = createMockActionNode('1');
    const targetNode = createMockActionNode('2', 'test.action', ['1']);

    queue.enqueue(targetNode, 0);

    // Dependency node 1 is not completed yet
    expect(queue.dequeueEligible({ '1': 'running' })).toBeNull();
    expect(queue.size()).toBe(1);

    // When node 1 completes, targetNode becomes eligible
    expect(queue.dequeueEligible({ '1': 'completed' })?.id).toBe('2');
    expect(queue.isEmpty()).toBe(true);
  });

  it('should remove a specific node by ID for cancellation', () => {
    const node = createMockActionNode('1');
    queue.enqueue(node);
    expect(queue.remove('1')).toBe(true);
    expect(queue.isEmpty()).toBe(true);
    expect(queue.remove('nonexistent')).toBe(false);
  });
});
