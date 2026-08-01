/**
 * CapabilityTelemetry.ts — Telemetry and performance metric tracker for Native Capability Drivers
 *
 * Tracks execution time, verification duration, rollback events, success percentages, and permission failures.
 */

export interface CapabilityMetrics {
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  totalExecutionTimeMs: number;
  averageLatencyMs: number;
  totalVerificationTimeMs: number;
  averageVerificationTimeMs: number;
  rollbackCount: number;
  permissionFailureCount: number;
  successRate: number;
}

export class CapabilityTelemetry {
  private metricsMap: Map<string, CapabilityMetrics> = new Map();

  private getOrCreate(capabilityId: string): CapabilityMetrics {
    let metrics = this.metricsMap.get(capabilityId);
    if (!metrics) {
      metrics = {
        totalInvocations: 0,
        successfulInvocations: 0,
        failedInvocations: 0,
        totalExecutionTimeMs: 0,
        averageLatencyMs: 0,
        totalVerificationTimeMs: 0,
        averageVerificationTimeMs: 0,
        rollbackCount: 0,
        permissionFailureCount: 0,
        successRate: 100,
      };
      this.metricsMap.set(capabilityId, metrics);
    }
    return metrics;
  }

  public recordExecution(capabilityId: string, durationMs: number, success: boolean, isPermissionError = false): void {
    const m = this.getOrCreate(capabilityId);
    m.totalInvocations++;
    m.totalExecutionTimeMs += durationMs;
    if (success) {
      m.successfulInvocations++;
    } else {
      m.failedInvocations++;
      if (isPermissionError) m.permissionFailureCount++;
    }
    m.averageLatencyMs = m.totalExecutionTimeMs / m.totalInvocations;
    m.successRate = Number(((m.successfulInvocations / m.totalInvocations) * 100).toFixed(2));
  }

  public recordVerification(capabilityId: string, durationMs: number): void {
    const m = this.getOrCreate(capabilityId);
    m.totalVerificationTimeMs += durationMs;
    m.averageVerificationTimeMs = m.totalVerificationTimeMs / Math.max(1, m.totalInvocations);
  }

  public recordRollback(capabilityId: string): void {
    const m = this.getOrCreate(capabilityId);
    m.rollbackCount++;
  }

  public getMetrics(capabilityId?: string): CapabilityMetrics {
    if (capabilityId) {
      return { ...this.getOrCreate(capabilityId) };
    }

    // Aggregate global metrics across all capabilities
    const totals: CapabilityMetrics = {
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      totalExecutionTimeMs: 0,
      averageLatencyMs: 0,
      totalVerificationTimeMs: 0,
      averageVerificationTimeMs: 0,
      rollbackCount: 0,
      permissionFailureCount: 0,
      successRate: 100,
    };

    for (const m of this.metricsMap.values()) {
      totals.totalInvocations += m.totalInvocations;
      totals.successfulInvocations += m.successfulInvocations;
      totals.failedInvocations += m.failedInvocations;
      totals.totalExecutionTimeMs += m.totalExecutionTimeMs;
      totals.totalVerificationTimeMs += m.totalVerificationTimeMs;
      totals.rollbackCount += m.rollbackCount;
      totals.permissionFailureCount += m.permissionFailureCount;
    }

    if (totals.totalInvocations > 0) {
      totals.averageLatencyMs = totals.totalExecutionTimeMs / totals.totalInvocations;
      totals.averageVerificationTimeMs = totals.totalVerificationTimeMs / totals.totalInvocations;
      totals.successRate = Number(((totals.successfulInvocations / totals.totalInvocations) * 100).toFixed(2));
    }

    return totals;
  }

  public reset(): void {
    this.metricsMap.clear();
  }
}

export const globalCapabilityTelemetry = new CapabilityTelemetry();
