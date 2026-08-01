import { describe, it, expect, vi } from 'vitest';
import { ExtensionPoints } from '../hooks/ExtensionPoints';

describe('ExtensionPoints — Event Hook Subscriptions', () => {
  it('should successfully emit to multiple subscribers', async () => {
    const ep = new ExtensionPoints();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    ep.subscribe('BeforePlanning', cb1);
    ep.subscribe('BeforePlanning', cb2);

    await ep.emit('BeforePlanning', { plan: 'test' });
    
    expect(cb1).toHaveBeenCalledWith({ plan: 'test' });
    expect(cb2).toHaveBeenCalledWith({ plan: 'test' });
  });

  it('should not crash if a subscriber throws', async () => {
    const ep = new ExtensionPoints();
    const cb1 = vi.fn().mockImplementation(() => { throw new Error('Hook failed'); });
    const cb2 = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    ep.subscribe('AfterExecution', cb1);
    ep.subscribe('AfterExecution', cb2);

    await expect(ep.emit('AfterExecution', {})).resolves.not.toThrow();
    expect(cb2).toHaveBeenCalled(); // Second callback still runs

    consoleErrorSpy.mockRestore();
  });
});
