import { describe, it, expect, beforeEach } from 'vitest';
import { ExperienceStore } from '../store/ExperienceStore';
import { PatternDiscoveryEngine } from '../discovery/PatternDiscoveryEngine';

describe('PatternDiscoveryEngine — Sequence and Preference Discovery', () => {
  let store: ExperienceStore;
  let discovery: PatternDiscoveryEngine;

  beforeEach(() => {
    store = new ExperienceStore();
    discovery = new PatternDiscoveryEngine(store);
  });

  it('should discover sequential patterns if frequency threshold is met', () => {
    // Sequence A -> B 
    for (let i = 0; i < 4; i++) {
      store.append({ id: `e${i}a`, category: 'project_started', entityId: 'Project A', timestamp: i * 100000, context: { sessionId: 's1' } });
      store.append({ id: `e${i}b`, category: 'workflow_executed', entityId: 'Workflow B', timestamp: (i * 100000) + 1000, context: { sessionId: 's1' } });
    }

    const patterns = discovery.discoverSequentialPatterns();
    expect(patterns.length).toBe(1);
    expect(patterns[0].sourceEntityId).toBe('Project A');
    expect(patterns[0].targetEntityId).toBe('Workflow B');
    expect(patterns[0].confidence).toBe(1.0);
    expect(patterns[0].occurrenceCount).toBe(4);
  });

  it('should discover frequency preferences based on heavy usage', () => {
    for (let i = 0; i < 5; i++) {
      store.append({ id: `a${i}`, category: 'application_opened', entityId: 'VSCode', timestamp: i, context: { sessionId: 's' } });
    }
    for (let i = 0; i < 2; i++) {
      store.append({ id: `b${i}`, category: 'application_opened', entityId: 'Xcode', timestamp: i, context: { sessionId: 's' } });
    }

    const prefs = discovery.discoverFrequencyPreferences('application_opened');
    expect(prefs.length).toBe(1);
    expect(prefs[0].targetEntityId).toBe('VSCode');
    expect(prefs[0].occurrenceCount).toBe(5);
  });
});
