import { describe, it, expect } from 'vitest';
import { GoalResolver } from '../GoalResolver';
import { ConversationResult, NormalizedGoal } from '../../conversation/ConversationTypes';

describe('GoalResolver', () => {
  const resolver = new GoalResolver();

  const createResult = (goalId: string, confidence: number, ambiguities: any[] = []): ConversationResult => ({
    goal: { id: goalId as NormalizedGoal, domain: 'unknown', action: 'unknown', raw: 'do something' },
    confidence,
    entities: [],
    context: { recentEntities: new Map(), recentGoals: [], activeSubject: null, turnCount: 1 },
    ambiguities,
    latencyMs: 10,
    source: 'llm'
  });

  it('should create a known goal node for high confidence', () => {
    const result = createResult('bluetooth.enable', 0.9);
    const node = resolver.resolve(result);
    
    expect(node.goal).toBe('bluetooth.enable');
    expect(node.planningState).toBe('known');
    expect(node.title).toBe('Enable Bluetooth');
  });

  it('should create an unknown goal node for low confidence', () => {
    const result = createResult('bluetooth.enable', 0.2);
    const node = resolver.resolve(result);
    
    expect(node.planningState).toBe('unknown');
  });

  it('should create an unknown goal node for unknown.unknown', () => {
    const result = createResult('unknown.unknown', 0.9);
    const node = resolver.resolve(result);
    
    expect(node.planningState).toBe('unknown');
  });

  it('should create a blocked goal node if missing entity ambiguity exists', () => {
    const result = createResult('bluetooth.connect', 0.9, [{ type: 'missing_entity', message: 'Missing', suggestions: [] }]);
    const node = resolver.resolve(result);
    
    expect(node.planningState).toBe('blocked');
  });
});
