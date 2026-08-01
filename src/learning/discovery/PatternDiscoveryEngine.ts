/**
 * PatternDiscoveryEngine.ts — Identifies recurring behaviors and sequences.
 *
 * Feeds the RankingEngine with learned context (e.g. "When opening VS Code, you usually run npm start").
 */

import { ExperienceStore } from '../store/ExperienceStore';
import { ExperienceRecord } from '../models/LearningTypes';

export interface DiscoveredPattern {
  readonly patternId: string;
  readonly type: 'sequence' | 'preference' | 'co_occurrence';
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly confidence: number;
  readonly occurrenceCount: number;
  readonly explanation: string;
}

export class PatternDiscoveryEngine {
  constructor(private store: ExperienceStore) {}

  /**
   * Discovers sequential patterns (A followed by B within a time window).
   * E.g., user opens repo X -> user starts workflow Y.
   */
  public discoverSequentialPatterns(timeWindowMs: number = 60000): DiscoveredPattern[] {
    const experiences = this.store.query();
    if (experiences.length < 2) return [];

    // Sort by timestamp
    const sorted = [...experiences].sort((a, b) => a.timestamp - b.timestamp);
    const sequences = new Map<string, number>();

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // If next event happened within time window
      if (next.timestamp - current.timestamp <= timeWindowMs) {
        // Simple distinct check to avoid self-loops for now
        if (current.entityId !== next.entityId) {
          const key = `${current.entityId} -> ${next.entityId}`;
          sequences.set(key, (sequences.get(key) || 0) + 1);
        }
      }
    }

    const patterns: DiscoveredPattern[] = [];
    sequences.forEach((count, key) => {
      if (count > 2) { // Minimum threshold to consider a pattern
        const [source, target] = key.split(' -> ');
        // Calculate confidence (simple count / total source occurrences)
        const sourceOccurrences = sorted.filter(e => e.entityId === source).length;
        const confidence = Math.min(count / sourceOccurrences, 1.0);

        patterns.push({
          patternId: `pat_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type: 'sequence',
          sourceEntityId: source,
          targetEntityId: target,
          confidence,
          occurrenceCount: count,
          explanation: `You usually trigger ${target} shortly after ${source}.`
        });
      }
    });

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Discovers raw frequency preferences (most used app, most used repair strategy).
   */
  public discoverFrequencyPreferences(category?: string): DiscoveredPattern[] {
    const experiences = this.store.query({ category });
    const frequencies = new Map<string, number>();

    for (const exp of experiences) {
      frequencies.set(exp.entityId, (frequencies.get(exp.entityId) || 0) + 1);
    }

    const patterns: DiscoveredPattern[] = [];
    const total = experiences.length;

    frequencies.forEach((count, entityId) => {
      if (count > 3) {
        patterns.push({
          patternId: `pat_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type: 'preference',
          sourceEntityId: 'global',
          targetEntityId: entityId,
          confidence: count / total,
          occurrenceCount: count,
          explanation: `This is frequently preferred (used ${count} times).`
        });
      }
    });

    return patterns.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
  }
}
