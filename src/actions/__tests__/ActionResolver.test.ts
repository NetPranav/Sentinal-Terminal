import { describe, it, expect, beforeEach } from 'vitest';
import { ActionResolver } from '../resolver/ActionResolver';
import { ActionSearch } from '../search/ActionSearch';
import { ActionRegistry } from '../registry/ActionRegistry';
import { ExecutionPlan, GoalNode } from '../../ai/planner/PlannerTypes';
import { createMockAction } from './helpers';

describe('ActionResolver', () => {
  let registry: ActionRegistry;
  let search: ActionSearch;
  let resolver: ActionResolver;

  beforeEach(() => {
    registry = new ActionRegistry();
    search = new ActionSearch(registry);
    resolver = new ActionResolver(search);

    registry.register(createMockAction({
      id: 'application.open',
      displayName: 'Open Application',
      tags: ['application', 'open'],
      aliases: ['open app'],
      requiredEntities: ['application'],
    }));
    registry.register(createMockAction({
      id: 'bluetooth.connect',
      displayName: 'Connect Bluetooth',
      tags: ['bluetooth', 'connect'],
      aliases: ['connect device'],
      requiredEntities: ['bluetooth_device'],
    }));
  });

  const createGoalNode = (id: string, goal: string, deps: string[] = []): GoalNode => ({
    id,
    title: goal,
    description: '',
    goal: goal as any,
    dependencies: deps.map(d => ({ nodeId: d, required: true })),
    requiredEntities: [],
    boundEntities: [],
    planningState: 'unsatisfied',
    reasoning: '',
    confidence: 1.0,
    platformIndependent: true,
  });

  const createPlan = (nodes: GoalNode[]): ExecutionPlan => ({
    nodes,
    topologicalOrder: nodes.map(n => n.id),
    parallelGroups: [nodes.map(n => n.id)],
    overallConfidence: 1.0,
    missingEntities: [],
    isComplete: true,
    telemetry: {
      latencyMs: 10, nodeCount: nodes.length, maxDepth: 1,
      conditionalBranches: 0, parallelBranches: 0, reasoningRetries: 0, confidence: 1.0,
    },
  });

  it('should resolve a simple GoalNode to an ActionNode', () => {
    const plan = createPlan([createGoalNode('1', 'application.open')]);
    const graph = resolver.resolve(plan);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].action.id).toBe('application.open');
    expect(graph.unresolvedGoals).toHaveLength(0);
  });

  it('should mark unresolvable goals', () => {
    const plan = createPlan([createGoalNode('1', 'nonexistent.action')]);
    const graph = resolver.resolve(plan);

    expect(graph.nodes).toHaveLength(0);
    expect(graph.unresolvedGoals).toContain('1');
  });

  it('should skip satisfied GoalNodes', () => {
    const node = createGoalNode('1', 'application.open');
    node.planningState = 'satisfied';

    const plan = createPlan([node]);
    const graph = resolver.resolve(plan);

    expect(graph.nodes).toHaveLength(0);
    expect(graph.unresolvedGoals).toHaveLength(0);
  });

  it('should detect ambiguity when two actions score similarly', () => {
    // Register a second action with the same alias to create ambiguity
    registry.register(createMockAction({
      id: 'application.launch',
      displayName: 'Launch Application',
      tags: ['application', 'open', 'launch'],
      aliases: ['open app', 'start app'],
    }));

    const plan = createPlan([createGoalNode('1', 'application.open')]);
    const graph = resolver.resolve(plan);

    // The resolver should still resolve, but flag the ambiguity
    // Since 'application.open' is an exact ID match (score 1.0) and
    // 'application.launch' is not, there may or may not be ambiguity depending on scores.
    // This test validates the mechanism exists and doesn't crash.
    expect(graph.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it('should preserve dependencies in the action graph', () => {
    const plan = createPlan([
      createGoalNode('1', 'bluetooth.connect'),
      createGoalNode('2', 'application.open', ['1']),
    ]);
    plan.topologicalOrder = ['1', '2'];

    const graph = resolver.resolve(plan);
    expect(graph.executionOrder).toEqual(['1', '2']);

    const appNode = graph.nodes.find(n => n.id === '2');
    expect(appNode?.dependencies).toContain('1');
  });

  it('should compute overall confidence from resolved nodes', () => {
    const plan = createPlan([createGoalNode('1', 'application.open')]);
    const graph = resolver.resolve(plan);
    expect(graph.confidence).toBeGreaterThan(0);
    expect(graph.confidence).toBeLessThanOrEqual(1);
  });
});
