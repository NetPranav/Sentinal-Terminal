import { describe, it, expect } from 'vitest';
import { GoalPlanner } from '../GoalPlanner';
import { ConversationResult, NormalizedGoal } from '../../conversation/ConversationTypes';
import { CurrentSystemState } from '../PlannerTypes';

// Mock LocalModel
class MockLocalModel {
  async generateJSON() {
    return {
      data: {
        subGoals: [
          {
            id: 'mock-1',
            title: 'Mock 1',
            description: 'Mock 1 desc',
            goal: 'mock.1',
            dependsOn: [],
            requiredEntities: ['file'],
            reasoning: 'Reason 1'
          }
        ]
      }
    };
  }
}

describe('GoalPlanner', () => {
  const model = new MockLocalModel() as any;
  const planner = new GoalPlanner(model);

  const createResult = (goalId: string, entities: any[] = []): ConversationResult => ({
    goal: { id: goalId as NormalizedGoal, domain: 'unknown', action: 'unknown', raw: 'do something' },
    confidence: 1.0,
    entities,
    context: { recentEntities: new Map(), recentGoals: [], activeSubject: null, turnCount: 1 },
    ambiguities: [],
    latencyMs: 10,
    source: 'llm'
  });

  it('should plan heuristic bluetooth connect', async () => {
    const result = createResult('bluetooth.connect', [{ type: 'bluetooth_device', value: 'AirPods', confidence: 1, raw: 'AirPods' }]);
    const plan = await planner.plan(result);
    
    expect(plan.nodes.length).toBe(5);
    expect(plan.isComplete).toBe(true);
    expect(plan.topologicalOrder).toEqual(['check-bt', 'enable-bt', 'scan-bt', 'locate-bt', 'connect-bt']);
  });

  it('should skip nodes satisfied by system state', async () => {
    const mockState: CurrentSystemState = {
      getState: (key: string) => key === 'bluetooth.status', // Bluetooth is already on
      hasEntity: () => false,
    };
    
    const result = createResult('bluetooth.connect', [{ type: 'bluetooth_device', value: 'AirPods', confidence: 1, raw: 'AirPods' }]);
    const plan = await planner.plan(result, mockState);
    
    expect(plan.nodes.find(n => n.id === 'check-bt')?.planningState).toBe('satisfied');
  });

  it('should flag missing entities when required', async () => {
    // Missing 'bluetooth_device' entity
    const result = createResult('bluetooth.connect', []);
    const plan = await planner.plan(result);
    
    expect(plan.isComplete).toBe(false);
    expect(plan.missingEntities.length).toBeGreaterThan(0);
    expect(plan.missingEntities[0].type).toBe('bluetooth_device');
  });

  it('should return empty plan for unknown goals with missing entities', async () => {
    const result = createResult('unknown.unknown');
    result.ambiguities = [{ type: 'missing_entity', message: 'Missing', suggestions: [] }];
    
    const plan = await planner.plan(result);
    
    expect(plan.nodes.length).toBe(1);
    expect(plan.nodes[0].planningState).toBe('blocked');
    expect(plan.isComplete).toBe(false);
  });
});
