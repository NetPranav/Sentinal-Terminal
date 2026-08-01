import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TraceEngine } from '../tracing/TraceEngine';

describe('TraceEngine — Zero Overhead Event Bus', () => {
  let engine: TraceEngine;

  beforeEach(() => {
    engine = new TraceEngine();
  });

  it('should record events and deep clone payloads when enabled', () => {
    const payload = { nested: { count: 1 } };
    engine.record('Runtime', 'NodeQueued', payload);

    const history = engine.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].eventName).toBe('NodeQueued');
    expect(history[0].subsystem).toBe('Runtime');
    
    // Original payload mutation should not affect the frozen clone
    payload.nested.count = 2;
    expect((history[0].payload as any).nested.count).toBe(1);
  });

  it('should drop events instantly when disabled for zero overhead', () => {
    engine.setEnabled(false);
    engine.record('Planner', 'PlanCreated', {});
    expect(engine.getHistory().length).toBe(0);
  });

  it('should emit to subscribers asynchronously', async () => {
    const cb = vi.fn();
    engine.subscribe(cb);
    engine.record('State', 'Updated', {});
    
    expect(cb).not.toHaveBeenCalled(); // Should be async
    await Promise.resolve(); // drain microtasks
    expect(cb).toHaveBeenCalled();
  });
});
