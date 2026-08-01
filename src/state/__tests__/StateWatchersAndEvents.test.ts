import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateEventBus } from '../events/StateEventBus';
import { StateWatchers } from '../watchers/StateWatchers';

describe('StateWatchers & StateEventBus — Real-Time Event-Driven Synchronization', () => {
  let eventBus: StateEventBus;
  let watchers: StateWatchers;

  beforeEach(() => {
    eventBus = new StateEventBus();
    watchers = new StateWatchers(eventBus);
  });

  it('should deliver typed system mutation events directly to specialized subscribers without polling', () => {
    const handler = vi.fn();
    eventBus.subscribe('ApplicationStarted', handler);

    watchers.notifyApplicationStarted('Xcode', 'com.apple.dt.Xcode', 8820);

    expect(handler).toHaveBeenCalledTimes(1);
    const eventArg = handler.mock.calls[0][0];
    expect(eventArg.type).toBe('ApplicationStarted');
    expect(eventArg.payload.name).toBe('Xcode');
    expect(eventArg.payload.pid).toBe(8820);
    expect(eventArg.source).toBe('watcher:application');
  });

  it('should allow wildcard subscriptions to receive and monitor all OS state deltas', () => {
    const wildcardHandler = vi.fn();
    eventBus.subscribe('*', wildcardHandler);

    watchers.notifyWifiChanged('Studio_5GHz');
    watchers.notifyPortOpened(8080, 4512, 'TCP');
    watchers.notifyFileCreated('/tmp/new_snapshot.log', 2048);

    expect(wildcardHandler).toHaveBeenCalledTimes(3);
    expect(eventBus.getRecentEvents(5).length).toBe(3);
  });

  it('should cleanly start and stop watcher daemons without resource leakage', () => {
    expect(watchers.isWatching()).toBe(false);
    watchers.startWatching();
    expect(watchers.isWatching()).toBe(true);
    watchers.stopWatching();
    expect(watchers.isWatching()).toBe(false);
  });
});
