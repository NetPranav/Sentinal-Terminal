import { describe, it, expect, beforeEach } from 'vitest';
import { StateCache } from '../cache/StateCache';
import { StateEventBus } from '../events/StateEventBus';

describe('StateCache — Hot/Cold Tiers & Event-Driven Invalidation', () => {
  let cache: StateCache;
  let eventBus: StateEventBus;

  beforeEach(() => {
    eventBus = new StateEventBus();
    cache = new StateCache(eventBus);
  });

  it('should differentiate Hot and Cold storage tiers accurately', () => {
    cache.set('wifi_status', { powered: true }, 'hot', 1.0);
    cache.set('installed_apps', ['Safari', 'Cursor'], 'cold', 1.0);

    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(2);
    expect(stats.hotEntries).toBe(1);
    expect(stats.coldEntries).toBe(1);
  });

  it('should dynamically evaluate freshness timestamps upon retrieval', async () => {
    // Set an entry with ultra-short TTL of 10ms
    cache.set('battery_level', 85, 'hot', 1.0, 'collector:battery', 10);
    const initial = cache.get<number>('battery_level');
    expect(initial?.freshness).toBe('hot');

    // Wait 15ms for expiration
    await new Promise(r => setTimeout(r, 20));
    const expired = cache.get<number>('battery_level');
    expect(expired?.freshness).toBe('expired');
  });

  it('should automatically invalidate cached domain state upon receiving real-time watcher events', () => {
    cache.set('wifi', { ssid: 'Old_SSID' }, 'hot');
    cache.set('currentSSID', 'Old_SSID', 'hot');
    cache.set('ownsPort:3000', 4510, 'hot');

    expect(cache.get('currentSSID')).toBeDefined();

    // Emit live Wi-Fi mutation event on the event bus
    eventBus.emit('WiFiConnected', { ssid: 'New_Corporate_SSID' }, 'watcher:wifi');

    // Wifi and currentSSID cache keys should be instantly purged
    expect(cache.get('currentSSID')).toBeUndefined();
    expect(cache.get('wifi')).toBeUndefined();
    // Unrelated network port key should remain intact
    expect(cache.get('ownsPort:3000')).toBeDefined();
  });
});
