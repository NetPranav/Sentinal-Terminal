import { describe, it, expect, beforeEach } from 'vitest';
import { ActionStateMachine } from '../state/ActionStateMachine';

describe('ActionStateMachine', () => {
  let sm: ActionStateMachine;

  beforeEach(() => {
    sm = new ActionStateMachine();
  });

  it('should initialize a node in created state', () => {
    sm.initialize('n-1');
    expect(sm.getState('n-1')).toBe('created');
  });

  it('should transition through valid lifecycle states', () => {
    sm.initialize('n-1');
    sm.transition('n-1', 'queued');
    sm.transition('n-1', 'waiting');
    sm.transition('n-1', 'running');
    sm.transition('n-1', 'completed');

    expect(sm.getState('n-1')).toBe('completed');
    expect(sm.isTerminal('n-1')).toBe(true);
  });

  it('should throw on invalid state transitions', () => {
    sm.initialize('n-1');
    expect(() => sm.transition('n-1', 'completed')).toThrow('Invalid state transition');
  });

  it('should identify retryable states', () => {
    sm.initialize('n-1');
    sm.transition('n-1', 'queued');
    sm.transition('n-1', 'running');
    sm.transition('n-1', 'failed');

    expect(sm.isRetryable('n-1')).toBe(true);
    expect(sm.isTerminal('n-1')).toBe(false);

    // Can transition from failed back to queued on retry
    sm.transition('n-1', 'queued');
    expect(sm.getState('n-1')).toBe('queued');
  });

  it('should export and restore state snapshot', () => {
    sm.initialize('n-1');
    sm.transition('n-1', 'queued');
    sm.initialize('n-2');

    const exported = sm.exportStates();
    const newSm = new ActionStateMachine();
    newSm.restoreStates(exported);

    expect(newSm.getState('n-1')).toBe('queued');
    expect(newSm.getState('n-2')).toBe('created');
  });
});
