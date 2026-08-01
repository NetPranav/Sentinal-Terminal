import { describe, it, expect } from 'vitest';
import { PlannerMemory } from '../PlannerMemory';
import { GoalNode } from '../PlannerTypes';
import { NormalizedGoal } from '../../conversation/ConversationTypes';

describe('PlannerMemory', () => {
  const memory = new PlannerMemory();

  const createNode = (id: string, confidence: number, state: any): GoalNode => ({
    id,
    title: 'Node',
    description: '',
    goal: 'unknown.unknown',
    dependencies: [],
    requiredEntities: [],
    boundEntities: [],
    planningState: state,
    reasoning: '',
    confidence,
    platformIndependent: true,
  });

  it('should cache highly confident nodes', () => {
    const nodes = [createNode('1', 0.9, 'unknown')];
    memory.set('test.goal' as NormalizedGoal, nodes);
    
    const cached = memory.get('test.goal' as NormalizedGoal);
    expect(cached).not.toBeNull();
    expect(cached![0].id).toBe('1');
    expect(memory.getHitCount()).toBe(1);
  });

  it('should NOT cache low confidence nodes', () => {
    const nodes = [createNode('1', 0.5, 'unknown')];
    memory.set('test.low' as NormalizedGoal, nodes);
    
    const cached = memory.get('test.low' as NormalizedGoal);
    expect(cached).toBeNull();
  });

  it('should NOT cache blocked nodes', () => {
    const nodes = [createNode('1', 0.9, 'blocked')];
    memory.set('test.blocked' as NormalizedGoal, nodes);
    
    const cached = memory.get('test.blocked' as NormalizedGoal);
    expect(cached).toBeNull();
  });

  it('should return null for non-existent goals', () => {
    const cached = memory.get('non.existent' as NormalizedGoal);
    expect(cached).toBeNull();
  });

  it('should clear memory', () => {
    const nodes = [createNode('1', 0.9, 'unknown')];
    memory.set('test.clear' as NormalizedGoal, nodes);
    memory.clear();
    
    const cached = memory.get('test.clear' as NormalizedGoal);
    expect(cached).toBeNull();
    expect(memory.getHitCount()).toBe(0);
  });
});
