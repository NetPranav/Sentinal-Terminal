/**
 * WorkflowTelemetry.ts — Execution Frequency, Duration, Success Rate, Template Usage & Repair Rate
 */

export interface WorkflowTelemetryMetrics {
  totalExecutions: number;
  successes: number;
  failures: number;
  successRate: number;
  totalDurationMs: number;
  averageDurationMs: number;
  mostUsedWorkflows: Array<{ workflowId: string; count: number }>;
  repairRate: number;
  lastUpdated: number;
}

export class WorkflowTelemetry {
  private executionCounts: Map<string, number> = new Map();
  private totalExecutions = 0;
  private successes = 0;
  private failures = 0;
  private totalDurationMs = 0;
  private repairsTriggered = 0;

  public recordExecution(success: boolean, durationMs: number, workflowId?: string): void {
    this.totalExecutions++;
    if (success) this.successes++;
    else this.failures++;
    this.totalDurationMs += durationMs;

    if (workflowId) {
      this.executionCounts.set(workflowId, (this.executionCounts.get(workflowId) || 0) + 1);
    }
  }

  public recordRepair(): void {
    this.repairsTriggered++;
  }

  public getMetrics(): WorkflowTelemetryMetrics {
    const mostUsed = Array.from(this.executionCounts.entries())
      .map(([workflowId, count]) => ({ workflowId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalExecutions: this.totalExecutions,
      successes: this.successes,
      failures: this.failures,
      successRate: this.totalExecutions > 0 ? Math.round((this.successes / this.totalExecutions) * 1000) / 10 : 100,
      totalDurationMs: Math.round(this.totalDurationMs * 100) / 100,
      averageDurationMs: this.totalExecutions > 0 ? Math.round((this.totalDurationMs / this.totalExecutions) * 100) / 100 : 0,
      mostUsedWorkflows: mostUsed,
      repairRate: this.totalExecutions > 0 ? Math.round((this.repairsTriggered / this.totalExecutions) * 1000) / 10 : 0,
      lastUpdated: Date.now(),
    };
  }

  public reset(): void {
    this.executionCounts.clear();
    this.totalExecutions = 0;
    this.successes = 0;
    this.failures = 0;
    this.totalDurationMs = 0;
    this.repairsTriggered = 0;
  }
}

export const globalWorkflowTelemetry = new WorkflowTelemetry();
