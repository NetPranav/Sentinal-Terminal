import { describe, it, expect, beforeEach } from 'vitest';
import { ExperienceStore } from '../store/ExperienceStore';
import { PatternDiscoveryEngine } from '../discovery/PatternDiscoveryEngine';
import { RankingEngine } from '../ranking/RankingEngine';
import { RecommendationEngine } from '../recommendations/RecommendationEngine';

describe('RecommendationEngine — Contextual Nudges & Explanations', () => {
  let store: ExperienceStore;
  let discovery: PatternDiscoveryEngine;
  let ranking: RankingEngine;
  let recommender: RecommendationEngine;

  beforeEach(() => {
    store = new ExperienceStore();
    discovery = new PatternDiscoveryEngine(store);
    ranking = new RankingEngine(store, discovery);
    recommender = new RecommendationEngine(ranking, discovery);
  });

  it('should generate recommendations from discovered sequences', () => {
    for (let i = 0; i < 4; i++) {
      store.append({ id: `a${i}`, category: 'application_opened', entityId: 'iTerm', timestamp: i * 10000, context: { sessionId: 's1' } });
      store.append({ id: `b${i}`, category: 'workflow_executed', entityId: 'Start Docker', timestamp: (i * 10000) + 1000, context: { sessionId: 's1' } });
    }

    const recs = recommender.generateRecommendations('iTerm');
    expect(recs.length).toBe(1);
    expect(recs[0].entityId).toBe('Start Docker');
    expect(recs[0].explanation).toContain('trigger Start Docker shortly after');
  });

  it('should explain rankings based on frequency, feedback, or recency', () => {
    // Generate some history for 'AppX'
    for (let i = 0; i < 15; i++) {
      store.append({ id: `x${i}`, category: 'application_opened', entityId: 'AppX', timestamp: Date.now() - 100000, context: { sessionId: 's1' } });
    }

    const explanation = recommender.explainRanking('AppX');
    expect(explanation).toContain("used it 15 times");

    // Add explicit user preference
    store.append({ id: `f1`, category: 'feedback_accepted', entityId: 'AppY', timestamp: Date.now(), context: { sessionId: 's1' } });
    const expY = recommender.explainRanking('AppY');
    expect(expY).toContain('explicitly preferred it');
  });
});
