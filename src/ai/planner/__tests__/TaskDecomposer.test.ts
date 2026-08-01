import { describe, it, expect, vi } from 'vitest';
import { TaskDecomposer } from '../TaskDecomposer';
import { GoalNode } from '../PlannerTypes';
import { ConversationResult, NormalizedGoal } from '../../conversation/ConversationTypes';

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

describe('TaskDecomposer', () => {
  const model = new MockLocalModel() as any;
  const decomposer = new TaskDecomposer(model);

  const createRoot = (goal: NormalizedGoal): GoalNode => ({
    id: 'root-id',
    title: 'Root',
    description: 'Root desc',
    goal,
    dependencies: [],
    requiredEntities: [],
    boundEntities: [],
    planningState: 'known',
    reasoning: '',
    confidence: 1,
    platformIndependent: true,
  });

  const mockResult = { entities: [] } as any as ConversationResult;

  it('should use heuristic for bluetooth.connect', async () => {
    const root = createRoot('bluetooth.connect');
    const nodes = await decomposer.decompose(root, mockResult);
    
    expect(nodes.length).toBe(5);
    expect(nodes[0].goal).toBe('bluetooth.status');
    expect(nodes[4].goal).toBe('bluetooth.connect');
  });

  it('should use heuristic for process.kill_by_port', async () => {
    const root = createRoot('process.kill_by_port');
    const nodes = await decomposer.decompose(root, mockResult);
    
    expect(nodes.length).toBe(3);
    expect(nodes[0].goal).toBe('application.find');
    expect(nodes[2].goal).toBe('process.kill');
  });

  it('should fallback to LLM for unknown goals', async () => {
    const root = createRoot('git.commit' as NormalizedGoal);
    const nodes = await decomposer.decompose(root, mockResult);
    
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('mock-1');
    expect(nodes[0].requiredEntities).toContain('file');
  });
});
