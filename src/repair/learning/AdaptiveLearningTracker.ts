/**
 * AdaptiveLearningTracker.ts — Structured Pattern Telemetry & Strategy Ranking
 *
 * Evaluates historical repair logs to identify recurring operational faults and rank
 * recovery strategy efficacy. Powered exclusively by structured telemetry (no ML training).
 */

import { RepairHistoryStore, globalRepairHistoryStore } from '../history/RepairHistoryStore';
import { FailureCategory } from '../models/FailureClassification';

export interface StrategyScore {
  strategyName: string;
  attempts: number;
  successes: number;
  successRate: number;
  avgLatencyMs: number;
}

export class AdaptiveLearningTracker {
  private historyStore: RepairHistoryStore;

  constructor(historyStore: RepairHistoryStore = globalRepairHistoryStore) {
    this.historyStore = historyStore;
  }

  /**
   * Determine the statistically most effective repair strategy name for a diagnosed failure category.
   */
  public getRecommendedStrategy(category: FailureCategory, fallbackStrategyName: string): string {
    const scores = this.rankStrategiesForCategory(category);
    if (scores.length > 0 && scores[0].attempts >= 2 && scores[0].successRate > 50) {
      return scores[0].strategyName;
    }
    return fallbackStrategyName;
  }

  /**
   * Rank all historical strategies tested against a specific failure taxonomy category.
   */
  public rankStrategiesForCategory(category: FailureCategory): StrategyScore[] {
    const records = this.historyStore.getHistory(500, category);
    const map = new Map<string, { attempts: number; successes: number; totalMs: number }>();

    for (const r of records) {
      if (!map.has(r.strategy)) {
        map.set(r.strategy, { attempts: 0, successes: 0, totalMs: 0 });
      }
      const data = map.get(r.strategy)!;
      data.attempts++;
      data.totalMs += r.latencyMs;
      if (r.outcome === 'success') data.successes++;
    }

    const scores: StrategyScore[] = [];
    for (const [name, data] of map.entries()) {
      scores.push({
        strategyName: name,
        attempts: data.attempts,
        successes: data.successes,
        successRate: Math.round((data.successes / data.attempts) * 100),
        avgLatencyMs: Math.round(data.totalMs / data.attempts),
      });
    }

    return scores.sort((a, b) => b.successRate - a.successRate || b.attempts - a.attempts);
  }

  /**
   * Return identified high-frequency failure patterns across recent execution sessions.
   */
  public getCommonFailurePatterns(limit = 5): Array<{ category: FailureCategory; count: number; dominantError: string }> {
    const all = this.historyStore.getHistory(500);
    const counts = new Map<FailureCategory, { count: number; errors: Record<string, number> }>();

    for (const item of all) {
      const cat = item.failure.category;
      if (!counts.has(cat)) {
        counts.set(cat, { count: 0, errors: {} });
      }
      const data = counts.get(cat)!;
      data.count++;
      const err = item.failure.errorMessage.substring(0, 40);
      data.errors[err] = (data.errors[err] || 0) + 1;
    }

    const results: Array<{ category: FailureCategory; count: number; dominantError: string }> = [];
    for (const [cat, data] of counts.entries()) {
      let dominantError = 'Various faults';
      let maxE = 0;
      for (const [eStr, c] of Object.entries(data.errors)) {
        if (c > maxE) { maxE = c; dominantError = eStr; }
      }
      results.push({ category: cat, count: data.count, dominantError });
    }

    return results.sort((a, b) => b.count - a.count).slice(0, limit);
  }
}

export const globalAdaptiveLearningTracker = new AdaptiveLearningTracker();
