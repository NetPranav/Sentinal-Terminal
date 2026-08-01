/**
 * VerificationEngine.ts — Decentralized Orchestration Engine for Execution Verification
 *
 * Coordinates postcondition verification across Capabilities without embedding domain-specific logic.
 * Publishes verified output parameters directly into the session's shared ExecutionContext.
 */

import { ICapability, CapabilityContext, CapabilityResult, VerificationResult } from '../capabilities/CapabilityTypes';

export class VerificationEngine {
  /**
   * Verifies execution results by delegating directly to the responsible capability driver.
   * On verification success, merges all verified outputs into the session ExecutionContext.
   */
  public async verifyAndPublish(
    capability: ICapability,
    ctx: CapabilityContext,
    execResult: CapabilityResult
  ): Promise<VerificationResult> {
    if (!execResult.success) {
      return {
        success: false,
        verifiedOutputs: {},
        durationMs: 0,
        warnings: ['Skipping verification due to failed prior execution step.'],
        verificationMethod: 'skipped',
      };
    }

    ctx.logger.debug(`VerificationEngine running verify for capability [${capability.metadata.id}] on node [${ctx.actionNode.id}]`);

    const result = await capability.verify(ctx, execResult);

    if (result.success && result.verifiedOutputs) {
      // Publish verified structured state back into ExecutionContext for downstream action nodes
      for (const [key, value] of Object.entries(result.verifiedOutputs)) {
        ctx.executionContext.setOutput(ctx.actionNode.id, key, value);
      }
      ctx.logger.debug(`Published ${Object.keys(result.verifiedOutputs).length} verified outputs into ExecutionContext for [${ctx.actionNode.id}]`);
    } else if (!result.success) {
      ctx.logger.warn(`Verification failed for node [${ctx.actionNode.id}]: ${result.error || 'Unknown postcondition failure'}`);
    }

    return result;
  }
}
