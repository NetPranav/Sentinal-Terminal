/**
 * RepairTelemetry.ts — Real-time Diagnostics & Self-Healing Performance Monitor
 *
 * Captures verification throughput, failure frequency, and automated repair recovery rates.
 */

export interface RepairTelemetryMetrics {
  totalVerifications: number;
  verificationsPassed: number;
  verificationsFailed: number;
  repairAttempts: number;
  repairsResolved: number;
  repairsEscalated: number;
  selfHealingSuccessRate: number;
  totalRepairDurationMs: number;
  averageRepairLatencyMs: number;
  lastUpdated: number;
}

export class RepairTelemetry {
  private metrics: RepairTelemetryMetrics = {
    totalVerifications: 0,
    verificationsPassed: 0,
    verificationsFailed: 0,
    repairAttempts: 0,
    repairsResolved: 0,
    repairsEscalated: 0,
    selfHealingSuccessRate: 100,
    totalRepairDurationMs: 0,
    averageRepairLatencyMs: 0,
    lastUpdated: Date.now(),
  };

  public recordVerification(success: boolean): void {
    this.metrics.totalVerifications++;
    if (success) this.metrics.verificationsPassed++;
    else this.metrics.verificationsFailed++;
    this.metrics.lastUpdated = Date.now();
  }

  public recordRepairOutcome(outcome: 'success' | 'failed' | 'escalated', durationMs: number): void {
    this.metrics.repairAttempts++;
    if (outcome === 'success') this.metrics.repairsResolved++;
    else if (outcome === 'escalated') this.metrics.repairsEscalated++;

    this.metrics.totalRepairDurationMs += durationMs;
    this.metrics.averageRepairLatencyMs = Math.round((this.metrics.totalRepairDurationMs / this.metrics.repairAttempts) * 100) / 100;
    
    const resolved = this.metrics.repairsResolved;
    this.metrics.selfHealingSuccessRate = Math.round((resolved / this.metrics.repairAttempts) * 1000) / 10;
    this.metrics.lastUpdated = Date.now();
  }

  public getMetrics(): Readonly<RepairTelemetryMetrics> {
    return { ...this.metrics };
  }

  public reset(): void {
    this.metrics = {
      totalVerifications: 0,
      verificationsPassed: 0,
      verificationsFailed: 0,
      repairAttempts: 0,
      repairsResolved: 0,
      repairsEscalated: 0,
      selfHealingSuccessRate: 100,
      totalRepairDurationMs: 0,
      averageRepairLatencyMs: 0,
      lastUpdated: Date.now(),
    };
  }
}

export const globalRepairTelemetry = new RepairTelemetry();
