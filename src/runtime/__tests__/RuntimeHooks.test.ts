import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuntimeHooks } from '../lifecycle/RuntimeHooks';
import { ExecutionEvent } from '../models/RuntimeTypes';

describe('RuntimeHooks', () => {
  let hooks: RuntimeHooks;
  const mockEvent: ExecutionEvent = {
    id: 'e-1',
    type: 'session_started',
    sessionId: 's-1',
    timestamp: Date.now(),
    data: { test: true },
  };

  beforeEach(() => {
    hooks = new RuntimeHooks();
  });

  it('should register and invoke lifecycle hook callbacks', async () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    hooks.register('before_session_start', fn1);
    hooks.register('before_session_start', fn2);

    await hooks.invoke('before_session_start', mockEvent);

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(fn1).toHaveBeenCalledWith(mockEvent);
  });

  it('should unsubscribe from hook callbacks', async () => {
    const fn = vi.fn();
    const unsub = hooks.register('after_action_execute', fn);

    await hooks.invoke('after_action_execute', mockEvent);
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    await hooks.invoke('after_action_execute', mockEvent);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should isolate hook execution errors from crashing runtime runtime', async () => {
    const errorFn = vi.fn().mockRejectedValue(new Error('Plugin crash'));
    const goodFn = vi.fn();

    hooks.register('on_failure', errorFn);
    hooks.register('on_failure', goodFn);

    // Must resolve cleanly without throwing
    await expect(hooks.invoke('on_failure', mockEvent)).resolves.toBeUndefined();
    expect(goodFn).toHaveBeenCalledTimes(1);
  });
});
