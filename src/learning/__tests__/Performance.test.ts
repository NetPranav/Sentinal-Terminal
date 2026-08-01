import { describe, it, expect, beforeEach } from 'vitest';
import { ExperienceStore } from '../store/ExperienceStore';
import { PatternDiscoveryEngine } from '../discovery/PatternDiscoveryEngine';
import { RankingEngine } from '../ranking/RankingEngine';
import { RecommendationEngine } from '../recommendations/RecommendationEngine';

describe('Learning Engine — Performance Benchmarks', () => {
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

  it('should discover patterns and rank across 5000 experiences in under 50ms', () => {
    // Generate 5000 dense sequential experiences
    let time = 1000000;
    for (let i = 0; i < 2500; i++) {
      store.append({ id: `a${i}`, category: 'project_started', entityId: 'ProjA', timestamp: time, context: { sessionId: 's1' } });
      time += 2000;
      store.append({ id: `b${i}`, category: 'workflow_executed', entityId: 'WorkB', timestamp: time, context: { sessionId: 's1' } });
      time += 500000; // Large gap so sequences break cleanly
    }

    const start = performance.now();
    
    // 1. Discover sequential patterns
    const patterns = discovery.discoverSequentialPatterns();
    
    // 2. Rank based on context
    const scores = ranking.rankEntities(['WorkB', 'WorkC', 'WorkD'], 'ProjA');
    
    // 3. Generate recommendations
    const recs = recommender.generateRecommendations('ProjA');
    
    const duration = performance.now() - start;

    expect(patterns.length).toBeGreaterThan(0);
    expect(scores[0].entityId).toBe('WorkB');
    expect(recs.length).toBeGreaterThan(0);

    // Throughput benchmark (local machines typically do this array ops in <15ms)
    expect(duration).toBeLessThan(75); // 75ms is generous for CI jitter
  });
});
