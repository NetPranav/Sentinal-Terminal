/**
 * RollbackEngine.ts — Decentralized Orchestration Engine for State Reversal
 *
 * Coordinates execution rollback across Capabilities without embedding domain-specific logic.
 * Collects and reports structured rollback metadata (reverted vs failed resources).
 */

import { ICapability, CapabilityContext, CapabilityResult, RollbackResult } from '../capabilities/CapabilityTypes';

interface RollbackRecord {
  capability: ICapability;
  ctx: CapabilityContext;
  execResult: CapabilityResult;
  timestamp: number;
}

export class RollbackEngine {
  private history: Map<string, RollbackRecord[]> = new Map();

  /**
   * Register an executed action step so that it can be reverted if a subsequent failure occurs.
   */
  public registerExecutedAction(
    sessionId: string,
    capability: ICapability,
    ctx: CapabilityContext,
    execResult: CapabilityResult
  ): void {
    if (!execResult.success) return; // Only rollback successful mutations
    
    const records = this.history.get(sessionId) || [];
    records.push({ capability, ctx, execResult, timestamp: Date.now() });
    this.history.set(sessionId, records);
  }

  /**
   * Execute rollback for a single node via its domain capability.
   */
  public async executeRollback(
    capability: ICapability,
    ctx: CapabilityContext,
    execResult: CapabilityResult
  ): Promise<RollbackResult> {
    ctx.logger.info(`Initiating rollback for node [${ctx.actionNode.id}] using capability [${capability.metadata.id}]`);
    
    const start = performance.now();
    try {
      const result = await capability.rollback(ctx, execResult);
      return result;
    } catch (err: any) {
      return {
        success: false,
        revertedResources: [],
        failedResources: [ctx.actionNode.id],
        durationMs: performance.now() - start,
        warnings: [`Unhandled rollback error: ${err?.message || String(err)}`],
        error: err?.message || String(err),
      };
    }
  }

  /**
   * Revert all recorded mutating actions for an entire execution session in reverse topological order.
   */
  public async rollbackSession(sessionId: string): Promise<RollbackResult> {
    const records = this.history.get(sessionId) || [];
    if (records.length === 0) {
      return { success: true, revertedResources: [], failedResources: [], durationMs: 0, warnings: [] };
    }

    const start = performance.now();
    const reverted: string[] = [];
    const failed: string[] = [];
    const allWarnings: string[] = [];
    let overallSuccess = true;

    // Execute reverse rollback sequence
    for (let i = records.length - 1; i >= 0; i--) {
      const rec = records[i];
      const res = await this.executeRollback(rec.capability, rec.ctx, rec.execResult);
      reverted.push(...res.revertedResources);
      failed.push(...res.failedResources);
      if (res.warnings) allWarnings.push(...res.warnings);
      if (!res.success) overallSuccess = false;
    }

    this.history.delete(sessionId);

    return {
      success: overallSuccess,
      revertedResources: reverted,
      failedResources: failed,
      durationMs: performance.now() - start,
      warnings: allWarnings,
    };
  }

  public clearSessionHistory(sessionId: string): void {
    this.history.delete(sessionId);
  }
}
