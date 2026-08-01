/**
 * PerformanceProfiler.ts — Distributed metric aggregator
 */

import { IDebugProvider } from '../providers/IDebugProvider';
import { Metric } from '../models/DevToolsTypes';

export class PerformanceProfiler {
  private providers: Set<IDebugProvider> = new Set();

  public registerProvider(provider: IDebugProvider): void {
    this.providers.add(provider);
  }

  public unregisterProvider(provider: IDebugProvider): void {
    this.providers.delete(provider);
  }

  /**
   * Aggregates live metrics from all registered subsystems natively.
   */
  public aggregateMetrics(): Record<string, Metric[]> {
    const report: Record<string, Metric[]> = {};

    this.providers.forEach(provider => {
      try {
        const metrics = provider.getMetrics();
        report[provider.subsystemName] = metrics;
      } catch (e) {
        console.error(`Profiler: Failed to fetch metrics from ${provider.subsystemName}`);
      }
    });

    return report;
  }
}
