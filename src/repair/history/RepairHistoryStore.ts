/**
 * RepairHistoryStore.ts — Structured Historical Recovery Attempt Repository
 *
 * Every repair attempt becomes structured historical data containing the diagnosed failure,
 * applied logical recovery plan, latency duration, and eventual resolution outcome.
 */

import { RepairHistoryEntry, RepairGraph } from '../models/RepairTypes';
import { FailureDiagnosis, FailureCategory } from '../models/FailureClassification';

export class RepairHistoryStore {
  private history: RepairHistoryEntry[] = [];
  private readonly maxLimit = 2000;

  public recordAttempt(
    failure: FailureDiagnosis,
    strategy: string,
    outcome: 'success' | 'failed' | 'escalated',
    latencyMs: number,
    retryAttempts = 1,
    repairGraph?: RepairGraph
  ): RepairHistoryEntry {
    const entry: RepairHistoryEntry = {
      id: `rep-hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      failure,
      strategy,
      repairGraph,
      outcome,
      latencyMs: Math.round(latencyMs * 100) / 100,
      timestamp: Date.now(),
      retryAttempts,
    };

    this.history.unshift(entry);
    if (this.history.length > this.maxLimit) {
      this.history.pop();
    }
    return entry;
  }

  public getHistory(limit = 50, categoryFilter?: FailureCategory): RepairHistoryEntry[] {
    if (categoryFilter) {
      return this.history.filter(e => e.failure.category === categoryFilter).slice(0, limit);
    }
    return this.history.slice(0, limit);
  }

  public getEntriesForAction(actionId: string): RepairHistoryEntry[] {
    return this.history.filter(e => e.failure.actionId === actionId);
  }

  public getStats(): { totalAttempts: number; successes: number; failures: number; escalated: number; successRate: number } {
    let successes = 0;
    let failures = 0;
    let escalated = 0;
    for (const item of this.history) {
      if (item.outcome === 'success') successes++;
      else if (item.outcome === 'failed') failures++;
      else escalated++;
    }
    const rate = this.history.length > 0 ? Math.round((successes / this.history.length) * 1000) / 10 : 0;
    return {
      totalAttempts: this.history.length,
      successes,
      failures,
      escalated,
      successRate: rate,
    };
  }

  public clear(): void {
    this.history = [];
  }
}

export const globalRepairHistoryStore = new RepairHistoryStore();
