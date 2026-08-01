import { describe, it, expect } from 'vitest';
import { DependencyResolver } from '../DependencyResolver';
import { GoalNode } from '../PlannerTypes';

describe('DependencyResolver', () => {
  const resolver = new DependencyResolver();

  const createNode = (id: string, deps: string[]): GoalNode => ({
    id,
    title: `Node ${id}`,
    description: '',
    goal: 'unknown.unknown',
    dependencies: deps.map(d => ({ nodeId: d, required: true })),
    requiredEntities: [],
    boundEntities: [],
    planningState: 'unsatisfied',
    reasoning: '',
    confidence: 1,
    platformIndependent: true,
  });

  it('should resolve a simple sequential graph', () => {
    const nodes = [
      createNode('A', []),
      createNode('B', ['A']),
      createNode('C', ['B'])
    ];

    const result = resolver.resolve(nodes);
    expect(result.topologicalOrder).toEqual(['A', 'B', 'C']);
    expect(result.parallelGroups).toEqual([['A'], ['B'], ['C']]);
  });

  it('should resolve a graph with parallel branches', () => {
    // A -> B
    // A -> C
    // B -> D
    // C -> D
    const nodes = [
      createNode('A', []),
      createNode('B', ['A']),
      createNode('C', ['A']),
      createNode('D', ['B', 'C'])
    ];

    const result = resolver.resolve(nodes);
    expect(result.topologicalOrder[0]).toBe('A');
    expect(['B', 'C']).toContain(result.topologicalOrder[1]);
    expect(['B', 'C']).toContain(result.topologicalOrder[2]);
    expect(result.topologicalOrder[3]).toBe('D');
    
    expect(result.parallelGroups.length).toBe(3);
    expect(result.parallelGroups[0]).toEqual(['A']);
    // B and C can run in parallel
    expect(result.parallelGroups[1]).toContain('B');
    expect(result.parallelGroups[1]).toContain('C');
    expect(result.parallelGroups[2]).toEqual(['D']);
  });

  it('should throw on circular dependency (A -> B -> A)', () => {
    const nodes = [
      createNode('A', ['B']),
      createNode('B', ['A'])
    ];

    expect(() => resolver.resolve(nodes)).toThrow('Circular dependency');
  });

  it('should throw on circular dependency (A -> B -> C -> A)', () => {
    const nodes = [
      createNode('A', ['C']),
      createNode('B', ['A']),
      createNode('C', ['B'])
    ];

    expect(() => resolver.resolve(nodes)).toThrow('Circular dependency');
  });

  it('should throw if a dependency does not exist', () => {
    const nodes = [
      createNode('A', ['B']) // B is not in the array
    ];

    expect(() => resolver.resolve(nodes)).toThrow('depends on non-existent node');
  });
});
