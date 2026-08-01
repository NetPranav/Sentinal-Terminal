/**
 * LearningTelemetry.ts — Metrics for Pattern Throughput and Engine Scale
 */

export interface LearningMetrics {
  totalExperiences: number;
  totalPatternsDiscovered: number;
  patternDiscoveryLatencyMs: number;
  recommendationsAccepted: number;
}

export class LearningTelemetry {
  private metrics: LearningMetrics = {
    totalExperiences: 0,
    totalPatternsDiscovered: 0,
    patternDiscoveryLatencyMs: 0,
    recommendationsAccepted: 0,
  };

  public recordPatternDiscovery(patternCount: number, latencyMs: number): void {
    this.metrics.totalPatternsDiscovered += patternCount;
    this.metrics.patternDiscoveryLatencyMs = latencyMs;
  }

  public recordRecommendationAcceptance(): void {
    this.metrics.recommendationsAccepted++;
  }

  public updateExperienceCount(count: number): void {
    this.metrics.totalExperiences = count;
  }

  public getMetrics(): LearningMetrics {
    return this.metrics;
  }
}

export const globalLearningTelemetry = new LearningTelemetry();
