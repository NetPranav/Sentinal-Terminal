/**
 * StateTelemetry.ts — Performance & Synchronization Diagnostics Metric Collector
 *
 * Monitors cache efficiency, query latency, and snapshot generation frequency.
 */

export interface StateTelemetryMetrics {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  collectorRefreshes: number;
  snapshotCount: number;
  diffCount: number;
  totalQueryDurationMs: number;
  averageQueryLatencyMs: number;
  lastUpdated: number;
}

export class StateTelemetry {
  private metrics: StateTelemetryMetrics = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 100,
    collectorRefreshes: 0,
    snapshotCount: 0,
    diffCount: 0,
    totalQueryDurationMs: 0,
    averageQueryLatencyMs: 0,
    lastUpdated: Date.now(),
  };

  public recordQuery(hit: boolean, durationMs: number): void {
    this.metrics.totalQueries++;
    if (hit) this.metrics.cacheHits++;
    else this.metrics.cacheMisses++;

    this.metrics.cacheHitRate = Math.round((this.metrics.cacheHits / this.metrics.totalQueries) * 100 * 100) / 100;
    this.metrics.totalQueryDurationMs += durationMs;
    this.metrics.averageQueryLatencyMs = Math.round((this.metrics.totalQueryDurationMs / this.metrics.totalQueries) * 1000) / 1000;
    this.metrics.lastUpdated = Date.now();
  }

  public recordCollectorRefresh(): void {
    this.metrics.collectorRefreshes++;
    this.metrics.lastUpdated = Date.now();
  }

  public recordSnapshotGenerated(): void {
    this.metrics.snapshotCount++;
    this.metrics.lastUpdated = Date.now();
  }

  public recordDiffComputed(): void {
    this.metrics.diffCount++;
    this.metrics.lastUpdated = Date.now();
  }

  public getMetrics(): Readonly<StateTelemetryMetrics> {
    return { ...this.metrics };
  }

  public reset(): void {
    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 100,
      collectorRefreshes: 0,
      snapshotCount: 0,
      diffCount: 0,
      totalQueryDurationMs: 0,
      averageQueryLatencyMs: 0,
      lastUpdated: Date.now(),
    };
  }
}

export const globalStateTelemetry = new StateTelemetry();
