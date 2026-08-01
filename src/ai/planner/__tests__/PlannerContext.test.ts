import { describe, it, expect } from 'vitest';
import { PlannerContext } from '../PlannerContext';

describe('PlannerContext', () => {
  it('should track missing entities', () => {
    const context = new PlannerContext();
    
    context.addMissingEntity('port', 'Need port to kill process');
    context.addMissingEntity('application', 'Need app name');
    
    const missing = context.getMissingEntities();
    expect(missing).toHaveLength(2);
    expect(missing[0].type).toBe('port');
    expect(missing[1].type).toBe('application');
  });

  it('should deduplicate missing entities', () => {
    const context = new PlannerContext();
    
    context.addMissingEntity('port', 'First reason');
    context.addMissingEntity('port', 'Second reason'); // Ignored
    
    const missing = context.getMissingEntities();
    expect(missing).toHaveLength(1);
    expect(missing[0].reason).toBe('First reason');
  });

  it('should evaluate system state if provided', () => {
    const mockState = {
      getState: (key: string) => key === 'bluetooth.status',
      hasEntity: () => false,
    };
    
    const context = new PlannerContext(mockState);
    expect(context.isGoalSatisfied('bluetooth.status')).toBe(true);
    expect(context.isGoalSatisfied('wifi.status')).toBe(false);
  });

  it('should always return false if system state is absent', () => {
    const context = new PlannerContext();
    expect(context.isGoalSatisfied('bluetooth.status')).toBe(false);
  });
});
