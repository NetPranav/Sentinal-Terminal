/**
 * DeveloperIndex.ts — Unified search across all observability structures
 */

import { TraceEngine } from '../tracing/TraceEngine';
import { TraceEvent } from '../models/DevToolsTypes';
import { IDebugProvider } from '../providers/IDebugProvider';

export interface SearchHit {
  readonly source: 'trace' | 'snapshot';
  readonly type: string;
  readonly id: string;
  readonly summary: string;
  readonly score: number;
}

export class DeveloperIndex {
  private providers: Set<IDebugProvider> = new Set();

  constructor(private traceEngine: TraceEngine) {}

  public registerProvider(provider: IDebugProvider): void {
    this.providers.add(provider);
  }

  public search(query: string): SearchHit[] {
    const term = query.toLowerCase();
    const hits: SearchHit[] = [];

    // 1. Search Historical Traces
    const history = this.traceEngine.getHistory();
    for (const evt of history) {
      if (
        evt.eventName.toLowerCase().includes(term) ||
        JSON.stringify(evt.payload).toLowerCase().includes(term)
      ) {
        hits.push({
          source: 'trace',
          type: evt.subsystem,
          id: evt.id,
          summary: `Trace: ${evt.eventName}`,
          score: 1.0
        });
      }
    }

    // 2. Search Live Snapshots
    this.providers.forEach(provider => {
      try {
        const snap = provider.getSnapshot();
        if (JSON.stringify(snap).toLowerCase().includes(term)) {
          hits.push({
            source: 'snapshot',
            type: provider.subsystemName,
            id: `snap_${provider.subsystemName}`,
            summary: `Live Snapshot Match in ${provider.subsystemName}`,
            score: 0.8 // Arbitrary scoring for demo
          });
        }
      } catch (e) {
        // Silently skip broken providers
      }
    });

    return hits.sort((a, b) => b.score - a.score);
  }
}
