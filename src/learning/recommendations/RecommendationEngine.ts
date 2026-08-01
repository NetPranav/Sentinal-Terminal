/**
 * RecommendationEngine.ts — Generates Contextual Nudges & Explanations
 */

import { RankingEngine } from '../ranking/RankingEngine';
import { PatternDiscoveryEngine } from '../discovery/PatternDiscoveryEngine';
import { Recommendation } from '../models/LearningTypes';

export class RecommendationEngine {
  constructor(
    private ranking: RankingEngine,
    private discovery: PatternDiscoveryEngine
  ) {}

  /**
   * Generates actionable recommendations based on the current context entity.
   */
  public generateRecommendations(currentEntityId: string): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // 1. Suggest Sequence Actions (e.g. "You usually open X after Y")
    const sequences = this.discovery.discoverSequentialPatterns();
    for (const seq of sequences) {
      if (seq.sourceEntityId === currentEntityId && seq.confidence > 0.6) {
        recommendations.push({
          id: `rec_${Date.now()}_${seq.targetEntityId}`,
          title: `Run ${seq.targetEntityId}`,
          actionId: 'execute_workflow', // abstract action
          entityId: seq.targetEntityId,
          confidence: seq.confidence,
          frequency: seq.occurrenceCount,
          recency: Date.now(), // Simplified
          supportingExperienceIds: [], // Would normally link to specific exp IDs
          explanation: seq.explanation // e.g. "You usually trigger target shortly after source."
        });
      }
    }

    // 2. We can also cross-reference RankingEngine for highly ranked global tools 
    // that haven't been used yet in this context, but we will keep this simple for now.

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Explains why an entity is ranked highly.
   */
  public explainRanking(entityId: string, contextEntityId?: string): string {
    const scores = this.ranking.rankEntities([entityId], contextEntityId);
    if (scores.length === 0) return 'No historical data available.';
    
    const score = scores[0];
    
    let explanation = `This is ranked highly (Score: ${score.score.toFixed(2)}) because `;
    
    if (score.userPreferenceWeight > 0) {
      explanation += `you explicitly preferred it. `;
    } else if (score.frequency > 10) {
      explanation += `you've used it ${score.frequency} times. `;
    } else if (score.recencyWeight > 0.8) {
      explanation += `you used it very recently. `;
    } else if (score.successRate === 1.0) {
      explanation += `it has a 100% success rate. `;
    } else {
      explanation += `it is the best available fallback.`;
    }

    return explanation.trim();
  }
}
