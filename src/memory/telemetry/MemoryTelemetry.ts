/**
 * MemoryTelemetry.ts — Metrics and Performance Tracking for Memory Engine
 */

export interface MemoryMetrics {
  totalQueries: number;
  cacheHits: number;
  hitRate: number;
  totalRetrievalLatencyMs: number;
  averageRetrievalLatencyMs: number;
  totalNodes: number;
  totalEdges: number;
  lastUpdated: number;
}

export class MemoryTelemetry {
  private totalQueries = 0;
  private cacheHits = 0;
  private totalRetrievalLatencyMs = 0;

  constructor(private getNodeCount: () => number, private getEdgeCount: () => number) {}

  public recordRetrieval(hit: boolean, latencyMs: number): void {
    this.totalQueries++;
    if (hit) this.cacheHits++;
    this.totalRetrievalLatencyMs += latencyMs;
  }

  public getMetrics(): MemoryMetrics {
    return {
      totalQueries: this.totalQueries,
      cacheHits: this.cacheHits,
      hitRate: this.totalQueries > 0 ? (this.cacheHits / this.totalQueries) * 100 : 0,
      totalRetrievalLatencyMs: this.totalRetrievalLatencyMs,
      averageRetrievalLatencyMs: this.totalQueries > 0 ? this.totalRetrievalLatencyMs / this.totalQueries : 0,
      totalNodes: this.getNodeCount(),
      totalEdges: this.getEdgeCount(),
      lastUpdated: Date.now(),
    };
  }

  public reset(): void {
    this.totalQueries = 0;
    this.cacheHits = 0;
    this.totalRetrievalLatencyMs = 0;
  }
}
