import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuntimeEventBus } from '../events/RuntimeEventBus';

describe('RuntimeEventBus', () => {
  let bus: RuntimeEventBus;

  beforeEach(() => {
    bus = new RuntimeEventBus();
  });

  it('should emit and receive specific events', () => {
    const handler = vi.fn();
    bus.on('session_started', handler);

    const ev = bus.emit('session_started', 'sess-1', { msg: 'start' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(ev);
    expect(ev.sessionId).toBe('sess-1');
    expect(ev.data).toEqual({ msg: 'start' });
  });

  it('should receive events on wildcard listener', () => {
    const wildcardHandler = vi.fn();
    bus.on('*', wildcardHandler);

    bus.emit('session_started', 'sess-1');
    bus.emit('action_started', 'sess-1', {}, 'node-1');

    expect(wildcardHandler).toHaveBeenCalledTimes(2);
  });

  it('should unsubscribe from events', () => {
    const handler = vi.fn();
    const unsubscribe = bus.on('action_queued', handler);

    bus.emit('action_queued', 'sess-1');
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    bus.emit('action_queued', 'sess-1');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should produce immutable event objects', () => {
    const ev = bus.emit('context_updated', 'sess-1', { val: 42 });
    expect(() => { (ev as any).sessionId = 'mutated'; }).toThrow();
    expect(() => { (ev.data as any).val = 99; }).toThrow();
  });

  it('should store and retrieve event history for replay', () => {
    bus.emit('session_started', 'sess-1');
    bus.emit('action_queued', 'sess-1', {}, 'node-1');
    bus.emit('session_started', 'sess-2');

    expect(bus.getHistory('sess-1')).toHaveLength(2);
    expect(bus.getHistory()).toHaveLength(3);

    bus.clearHistory('sess-1');
    expect(bus.getHistory('sess-1')).toHaveLength(0);
    expect(bus.getHistory('sess-2')).toHaveLength(1);
  });
});
