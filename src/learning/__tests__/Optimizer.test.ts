import { describe, it, expect, beforeEach } from 'vitest';
import { ExperienceStore } from '../store/ExperienceStore';
import { PatternDiscoveryEngine } from '../discovery/PatternDiscoveryEngine';
import { Optimizer } from '../optimizer/Optimizer';

describe('Optimizer — Synthesizing Long-Term Context Defaults', () => {
  let store: ExperienceStore;
  let discovery: PatternDiscoveryEngine;
  let optimizer: Optimizer;

  beforeEach(() => {
    store = new ExperienceStore();
    discovery = new PatternDiscoveryEngine(store);
    optimizer = new Optimizer(discovery);
  });

  it('should synthesize preferred IDE and Browser from history', () => {
    // 5 opens for VS Code
    for (let i = 0; i < 5; i++) {
      store.append({ id: `c${i}`, category: 'application_opened', entityId: 'VS Code', timestamp: i, context: { sessionId: 's' } });
    }
    // 4 opens for Chrome
    for (let i = 0; i < 4; i++) {
      store.append({ id: `b${i}`, category: 'application_opened', entityId: 'Google Chrome', timestamp: i, context: { sessionId: 's' } });
    }

    const defaults = optimizer.synthesizeDefaults();
    expect(defaults.preferredIde).toBe('VS Code');
    expect(defaults.preferredBrowser).toBe('Google Chrome');
  });

  it('should synthesize preferred repair strategies', () => {
    for (let i = 0; i < 6; i++) {
      store.append({ id: `r${i}`, category: 'repair_performed', entityId: 'repair_restart_service', timestamp: i, context: { sessionId: 's' } });
    }

    const defaults = optimizer.synthesizeDefaults();
    expect(defaults.preferredRepairStrategy).toBe('repair_restart_service');
  });
});
