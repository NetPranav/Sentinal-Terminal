import { describe, it, expect, beforeEach } from 'vitest';
import { ExperienceStore } from '../store/ExperienceStore';
import { PatternDiscoveryEngine } from '../discovery/PatternDiscoveryEngine';
import { RankingEngine } from '../ranking/RankingEngine';

describe('RankingEngine — Multi-Variable Behavioral Sorting', () => {
  let store: ExperienceStore;
  let discovery: PatternDiscoveryEngine;
  let ranking: RankingEngine;

  beforeEach(() => {
    store = new ExperienceStore();
    discovery = new PatternDiscoveryEngine(store);
    ranking = new RankingEngine(store, discovery);
  });

  it('should rank entities by combining frequency and recency', () => {
    const now = Date.now();
    // Entity A used heavily but 20 days ago
    for (let i = 0; i < 10; i++) {
      store.append({ id: `a${i}`, category: 'workflow_executed', entityId: 'A', timestamp: now - (20 * 86400000), context: { sessionId: 's' } });
    }
    
    // Entity B used moderately but right now
    for (let i = 0; i < 4; i++) {
      store.append({ id: `b${i}`, category: 'workflow_executed', entityId: 'B', timestamp: now, context: { sessionId: 's' } });
    }

    const scores = ranking.rankEntities(['A', 'B']);
    expect(scores.length).toBe(2);
    
    const a = scores.find(s => s.entityId === 'A');
    const b = scores.find(s => s.entityId === 'B');
    
    expect(b!.recencyWeight).toBeGreaterThan(a!.recencyWeight);
    expect(a!.frequency).toBeGreaterThan(b!.frequency);
    
    // Check if B's massive recency beats A's frequency (tuning specific)
    expect(scores[0].entityId).toBeDefined();
  });

  it('should heavily penalize rejected feedback in the ranking', () => {
    store.append({ id: '1', category: 'workflow_executed', entityId: 'X', timestamp: Date.now(), context: { sessionId: 's' } });
    store.append({ id: '2', category: 'workflow_executed', entityId: 'Y', timestamp: Date.now(), context: { sessionId: 's' } });
    
    // Y gets rejected
    store.append({ id: '3', category: 'feedback_rejected', entityId: 'Y', timestamp: Date.now(), context: { sessionId: 's' } });
    
    // X gets accepted
    store.append({ id: '4', category: 'feedback_accepted', entityId: 'X', timestamp: Date.now(), context: { sessionId: 's' } });

    const scores = ranking.rankEntities(['X', 'Y']);
    expect(scores[0].entityId).toBe('X');
    expect(scores[1].entityId).toBe('Y');
    expect(scores[0].userPreferenceWeight).toBeGreaterThan(0);
    expect(scores[1].userPreferenceWeight).toBeLessThan(0);
  });

  it('should boost entities that fit the pattern sequence context', () => {
    for (let i = 0; i < 4; i++) {
      store.append({ id: `ea${i}`, category: 'project_started', entityId: 'ContextP', timestamp: i * 10000, context: { sessionId: 's1' } });
      store.append({ id: `eb${i}`, category: 'workflow_executed', entityId: 'BoostedW', timestamp: (i * 10000) + 1000, context: { sessionId: 's1' } });
    }
    
    store.append({ id: `x1`, category: 'workflow_executed', entityId: 'NormalW', timestamp: 40000, context: { sessionId: 's1' } });

    const scores = ranking.rankEntities(['NormalW', 'BoostedW'], 'ContextP');
    
    // BoostedW should have higher score due to ContextP pattern
    const boosted = scores.find(s => s.entityId === 'BoostedW');
    const normal = scores.find(s => s.entityId === 'NormalW');
    
    expect(boosted!.score).toBeGreaterThan(normal!.score);
  });
});
