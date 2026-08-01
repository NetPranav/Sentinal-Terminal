import { describe, it, expect } from 'vitest';
import { PlanValidator } from '../PlanValidator';
import { ExecutionPlan, GoalNode } from '../PlannerTypes';
import { EntityType } from '../../conversation/ConversationTypes';

describe('PlanValidator', () => {
  const validator = new PlanValidator();

  const createPlan = (nodes: GoalNode[]): ExecutionPlan => ({
    nodes,
    topologicalOrder: nodes.map(n => n.id),
    parallelGroups: [nodes.map(n => n.id)],
    overallConfidence: 1.0,
    missingEntities: [],
    isComplete: false,
    telemetry: {
      latencyMs: 10,
      nodeCount: nodes.length,
      maxDepth: 1,
      conditionalBranches: 0,
      parallelBranches: 0,
      reasoningRetries: 0,
      confidence: 1.0
    }
  });

  const createNode = (id: string, required: EntityType[], bound: EntityType[]): GoalNode => ({
    id,
    title: `Node ${id}`,
    description: '',
    goal: 'unknown.unknown',
    dependencies: [],
    requiredEntities: required,
    boundEntities: bound.map(type => ({ type, value: 'mock', confidence: 1, raw: 'mock' })),
    planningState: 'unsatisfied',
    reasoning: '',
    confidence: 1,
    platformIndependent: true,
  });

  it('should throw if plan is empty', () => {
    const plan = createPlan([]);
    expect(() => validator.validate(plan)).toThrow('Plan is empty');
  });

  it('should pass if all required entities are bound', () => {
    const plan = createPlan([
      createNode('A', ['application'], ['application'])
    ]);

    validator.validate(plan);
    expect(plan.isComplete).toBe(true);
    expect(plan.missingEntities).toHaveLength(0);
    expect(plan.overallConfidence).toBe(1.0);
  });

  it('should mark node as blocked and plan incomplete if entity is missing', () => {
    const plan = createPlan([
      createNode('A', ['port'], [])
    ]);

    validator.validate(plan);
    expect(plan.isComplete).toBe(false);
    expect(plan.missingEntities).toHaveLength(1);
    expect(plan.missingEntities[0].type).toBe('port');
    expect(plan.missingEntities[0].blockedNodeId).toBe('A');
    expect(plan.nodes[0].planningState).toBe('blocked');
    expect(plan.nodes[0].reasoning).toContain('[Blocked: Missing required entity \'port\']');
    expect(plan.overallConfidence).toBe(0.6); // Reduced by 0.4
  });

  it('should handle low confidence plans', () => {
    const plan = createPlan([
      createNode('A', [], [])
    ]);
    plan.overallConfidence = 0.1;

    validator.validate(plan);
    expect(plan.isComplete).toBe(false);
  });
});
