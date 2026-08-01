import { describe, it, expect, beforeEach } from 'vitest';
import { StateCollectorManager } from '../collectors/StateCollectorManager';

describe('StateCollectorManager — Decentralized Capability Collector Isolation', () => {
  let manager: StateCollectorManager;

  beforeEach(() => {
    manager = new StateCollectorManager(true); // Auto-load Phase 5 SDK capabilities
  });

  it('should automatically register isolated state collectors for all Phase 5 capability drivers', () => {
    const all = manager.getAllCollectors();
    expect(all.length).toBeGreaterThanOrEqual(13);

    expect(manager.getCollector('wifi')).toBeDefined();
    expect(manager.getCollector('bluetooth')).toBeDefined();
    expect(manager.getCollector('process')).toBeDefined();
    expect(manager.getCollector('filesystem')).toBeDefined();
  });

  it('should harvest state across all domain collectors without centralized operating system queries', async () => {
    const harvested = await manager.collectAll();
    expect(harvested.length).toBeGreaterThanOrEqual(13);

    const wifiState = harvested.find(h => h.domain === 'wifi');
    expect(wifiState).toBeDefined();
    expect(wifiState?.confidence).toBe(1.0);
    expect(wifiState?.source).toContain('collector:');
  });

  it('should support harvesting state filtered by hot or cold cache tiers', async () => {
    const hotOnly = await manager.collectAll('hot');
    expect(hotOnly.length).toBeGreaterThan(0);
    expect(hotOnly.every(h => h.tier === 'hot')).toBe(true);
  });
});
