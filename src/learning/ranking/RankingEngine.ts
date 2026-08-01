/**
 * RankingEngine.ts — Adaptive Sorting based on Experience
 *
 * Deterministically sorts entities based on frequency, recency, success rate, and user feedback.
 */

import { ExperienceStore } from '../store/ExperienceStore';
import { PatternDiscoveryEngine } from '../discovery/PatternDiscoveryEngine';
import { RankingScore } from '../models/LearningTypes';

export class RankingEngine {
  constructor(
    private store: ExperienceStore,
    private discovery: PatternDiscoveryEngine
  ) {}

  /**
   * Calculate ranking scores for a list of entity IDs based on historical experience.
   */
  public rankEntities(entityIds: string[], contextEntityId?: string): RankingScore[] {
    const scores: RankingScore[] = [];
    const currentTime = Date.now();
    
    // Discover contextual patterns if a context entity is provided
    let contextBoosts = new Map<string, number>();
    if (contextEntityId) {
      const sequences = this.discovery.discoverSequentialPatterns();
      for (const seq of sequences) {
        if (seq.sourceEntityId === contextEntityId) {
          contextBoosts.set(seq.targetEntityId, seq.confidence);
        }
      }
    }

    for (const id of entityIds) {
      const experiences = this.store.query({ entityId: id });
      
      let successCount = 0;
      let totalCount = 0;
      let mostRecent = 0;
      let userPreference = 0;

      for (const exp of experiences) {
        if (exp.timestamp > mostRecent) mostRecent = exp.timestamp;

        // Feedback scoring
        if (exp.category === 'feedback_accepted') userPreference += 2.0;
        else if (exp.category === 'feedback_rejected') userPreference -= 5.0; // Strong penalty
        else if (exp.category === 'feedback_ignored') userPreference -= 0.5;

        // Execution/Repair scoring
        if (
          exp.category === 'workflow_executed' || 
          exp.category === 'repair_performed' || 
          exp.category === 'application_opened'
        ) {
          totalCount++;
          // For simplicity, we assume presence here is success unless verification_failed exists
          // A real implementation would link verification failures to these executions.
          // We will count it as success in this mock.
          successCount++;
        }

        if (exp.category === 'verification_failed') {
          totalCount++;
          // no successCount increment
        }
      }

      // Calculate recency weight (0.0 to 1.0, exponentially decaying over 30 days)
      const ageDays = mostRecent > 0 ? (currentTime - mostRecent) / (1000 * 60 * 60 * 24) : 30;
      const recencyWeight = Math.max(0, Math.exp(-ageDays / 15)); // Decay half-life ~10 days

      // Calculate base metrics
      const frequency = totalCount;
      const successRate = totalCount > 0 ? successCount / totalCount : 0.5; // Default 0.5 for unknown

      // Context Boost
      const contextBoost = contextBoosts.get(id) || 0;

      // Final Score Calculation Formula
      // (Success * 0.4) + (NormalizedFreq * 0.2) + (Recency * 0.2) + (ContextBoost * 0.2) + UserPreference
      const normalizedFreq = Math.min(frequency / 50, 1.0); // Cap normalization at 50 uses
      
      const score = (successRate * 0.4) + 
                    (normalizedFreq * 0.2) + 
                    (recencyWeight * 0.2) + 
                    (contextBoost * 0.2) + 
                    (userPreference * 0.5);

      scores.push({
        entityId: id,
        score,
        successRate,
        frequency,
        recencyWeight,
        userPreferenceWeight: userPreference
      });
    }

    // Sort descending by score
    return scores.sort((a, b) => b.score - a.score);
  }
}
