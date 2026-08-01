import { describe, it, expect } from 'vitest';
import { PlanningStrategy } from '../PlanningStrategy';
import { PlannerContext } from '../PlannerContext';
import { GoalNode } from '../PlannerTypes';
import { EntityType } from '../../conversation/ConversationTypes';

describe('PlanningStrategy', () => {
  it('should mark node as satisfied if system state confirms it', () => {
    // Mock system state
    const mockState = {
      getState: (key: string) => key === 'bluetooth.status' ? true : false,
      hasEntity: (type: EntityType, value: string) => false,
    };
    
    const context = new PlannerContext(mockState);
    const strategy = new PlanningStrategy(context);

    const nodes: GoalNode[] = [
      {
        id: '1',
        title: 'Check Bluetooth State',
        description: '',
        goal: 'bluetooth.status',
        dependencies: [],
        requiredEntities: [],
        boundEntities: [],
        planningState: 'unsatisfied',
        reasoning: 'Reasoning',
        confidence: 1,
        platformIndependent: true,
      },
      {
        id: '2',
        title: 'Enable Bluetooth',
        description: '',
        goal: 'bluetooth.enable',
        dependencies: [],
        requiredEntities: [],
        boundEntities: [],
        planningState: 'unsatisfied',
        reasoning: 'Reasoning',
        confidence: 1,
        platformIndependent: true,
      }
    ];

    const result = strategy.applyStrategy(nodes);

    expect(result[0].planningState).toBe('satisfied');
    expect(result[0].reasoning).toContain('[Skipped: Goal already satisfied by system state]');
    
    expect(result[1].planningState).toBe('unsatisfied');
  });

  it('should not modify anything if system state is null', () => {
    const context = new PlannerContext(undefined);
    const strategy = new PlanningStrategy(context);

    const nodes: GoalNode[] = [
      {
        id: '1',
        title: 'Check Bluetooth State',
        description: '',
        goal: 'bluetooth.status',
        dependencies: [],
        requiredEntities: [],
        boundEntities: [],
        planningState: 'unsatisfied',
        reasoning: 'Reasoning',
        confidence: 1,
        platformIndependent: true,
      }
    ];

    const result = strategy.applyStrategy(nodes);
    expect(result[0].planningState).toBe('unsatisfied');
  });
});
