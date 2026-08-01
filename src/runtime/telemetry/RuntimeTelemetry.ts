/**
 * RuntimeTelemetry.ts — Rich execution metrics
 */

import { ExecutionMetrics } from '../models/RuntimeTypes';

export class RuntimeTelemetry {
  private startTime = 0;
  private nodeStartTimes: Map<string, number> = new Map();
  private nodeDurations: number[] = [];
  private queueWaits: number[] = [];
  private retries = 0;
  private cancellations = 0;
  private timeouts = 0;
  private parallelNodes = 0;
  private depResolutionStart = 0;
  private depResolutionTotal = 0;

  public sessionStart(): void { this.startTime = performance.now(); }

  public nodeQueued(nodeId: string): void { this.queueWaits.push(performance.now()); }

  public nodeStarted(nodeId: string): void {
    this.nodeStartTimes.set(nodeId, performance.now());
  }

  public nodeCompleted(nodeId: string): void {
    const start = this.nodeStartTimes.get(nodeId);
    if (start) this.nodeDurations.push(performance.now() - start);
  }

  public recordRetry(): void { this.retries++; }
  public recordCancellation(): void { this.cancellations++; }
  public recordTimeout(): void { this.timeouts++; }
  public recordParallelNode(): void { this.parallelNodes++; }

  public depResolutionBegin(): void { this.depResolutionStart = performance.now(); }
  public depResolutionEnd(): void {
    this.depResolutionTotal += performance.now() - this.depResolutionStart;
  }

  public getMetrics(): ExecutionMetrics {
    const totalDurationMs = performance.now() - this.startTime;
    const activeExecutionTimeMs = this.nodeDurations.reduce((a, b) => a + b, 0);
    const idleTimeMs = Math.max(0, totalDurationMs - activeExecutionTimeMs);
    const nodesExecuted = this.nodeDurations.length;
    const averageNodeDurationMs = nodesExecuted > 0
      ? activeExecutionTimeMs / nodesExecuted
      : 0;
    const parallelUtilization = nodesExecuted > 0
      ? this.parallelNodes / nodesExecuted
      : 0;

    return {
      totalDurationMs,
      idleTimeMs,
      queueWaitTimeMs: 0, // Simplified for Phase 4
      activeExecutionTimeMs,
      parallelUtilization,
      retryCount: this.retries,
      cancellationCount: this.cancellations,
      timeoutCount: this.timeouts,
      dependencyResolutionTimeMs: this.depResolutionTotal,
      averageNodeDurationMs,
      nodesExecuted,
      nodesParallel: this.parallelNodes,
    };
  }

  public reset(): void {
    this.startTime = 0;
    this.nodeStartTimes.clear();
    this.nodeDurations = [];
    this.queueWaits = [];
    this.retries = 0;
    this.cancellations = 0;
    this.timeouts = 0;
    this.parallelNodes = 0;
    this.depResolutionTotal = 0;
  }
}
