/**
 * WorkflowHistory.ts — Structured Workflow Execution History Repository
 *
 * Stores execution records containing duration, node outcomes, failures, repairs, and outputs.
 */

import { WorkflowInstance, WorkflowInstanceStatus } from '../models/WorkflowTypes';

export class WorkflowHistory {
  private records: WorkflowInstance[] = [];
  private readonly maxRecords = 5000;

  public recordExecution(instance: WorkflowInstance): void {
    this.records.unshift(instance);
    if (this.records.length > this.maxRecords) {
      this.records.pop();
    }
  }

  public getHistory(workflowId?: string, limit = 50): WorkflowInstance[] {
    if (workflowId) {
      return this.records.filter(r => r.workflowId === workflowId).slice(0, limit);
    }
    return this.records.slice(0, limit);
  }

  public getLastExecution(workflowId: string): WorkflowInstance | undefined {
    return this.records.find(r => r.workflowId === workflowId);
  }

  public getStats(workflowId?: string): {
    totalExecutions: number;
    successes: number;
    failures: number;
    avgDurationMs: number;
    totalRepairs: number;
  } {
    const filtered = workflowId
      ? this.records.filter(r => r.workflowId === workflowId)
      : this.records;

    let successes = 0;
    let failures = 0;
    let totalDuration = 0;
    let totalRepairs = 0;

    for (const r of filtered) {
      if (r.status === 'completed') successes++;
      else if (r.status === 'failed') failures++;
      totalDuration += r.durationMs || 0;
      totalRepairs += r.repairsInvoked;
    }

    return {
      totalExecutions: filtered.length,
      successes,
      failures,
      avgDurationMs: filtered.length > 0 ? Math.round(totalDuration / filtered.length) : 0,
      totalRepairs,
    };
  }

  public clear(): void {
    this.records = [];
  }
}

export const globalWorkflowHistory = new WorkflowHistory();
