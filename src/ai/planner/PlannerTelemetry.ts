import { PlannerTelemetry } from './PlannerTypes';

export class TelemetryTracker {
  private startTime: number = 0;
  
  public start(): void {
    this.startTime = performance.now();
  }
  
  public end(nodeCount: number, confidence: number): PlannerTelemetry {
    return {
      latencyMs: performance.now() - this.startTime,
      nodeCount,
      maxDepth: 1, // Phase 2 default, later computed by recursive decomposer
      conditionalBranches: 0,
      parallelBranches: 0,
      reasoningRetries: 0,
      confidence
    };
  }
}
