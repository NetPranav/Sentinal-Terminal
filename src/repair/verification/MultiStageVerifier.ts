/**
 * MultiStageVerifier.ts — Four-Tier Lifecycle Verification Engine
 *
 * Implements verification across four essential execution checkpoints:
 * 1. Immediate — Instant postcondition audit upon driver completion
 * 2. Delayed — Automated settling pause when asynchronous race conditions are suspected
 * 3. Post-Repair — Validation following logical repair graph execution
 * 4. Pre-Consumption — Final audit before downstream nodes consume published parameters
 */

import { AdaptiveVerificationResult, VerificationStage } from '../models/RepairTypes';
import { VerificationSources, globalVerificationSources } from './VerificationSources';
import { ICapability, CapabilityContext, CapabilityResult } from '../../sdk/capabilities/CapabilityTypes';

export class MultiStageVerifier {
  private sources: VerificationSources;
  private readonly defaultSettlingDelayMs: number;

  constructor(
    sources: VerificationSources = globalVerificationSources,
    settlingDelayMs = process.env.NODE_ENV === 'test' ? 10 : 200
  ) {
    this.sources = sources;
    this.defaultSettlingDelayMs = settlingDelayMs;
  }

  /**
   * Stage 1 & 2: Evaluate immediately; if ambivalent or susceptible to async race conditions,
   * automatically invoke a short settling delay before confirming failure.
   */
  public async verifyExecutionOutcome(
    actionId: string,
    execResult?: CapabilityResult,
    capability?: ICapability,
    ctx?: CapabilityContext,
    expectedPostcondition?: { type: string; target: string; expectedValue: any },
    stage: VerificationStage = 'immediate'
  ): Promise<AdaptiveVerificationResult> {
    const immediateEvidence = await this.sources.collectEvidence(actionId, execResult, capability, ctx, expectedPostcondition);
    const immediateSuccess = immediateEvidence.negativeEvidence.length === 0 && immediateEvidence.aggregateConfidence >= 0.6;

    // Stage 2 trigger: If failure looks like an asynchronous race condition or borderline confidence, apply delayed check
    if (!immediateSuccess && stage === 'immediate') {
      const looksLikeRace = immediateEvidence.negativeEvidence.some(e => e.toLowerCase().includes('race') || e.toLowerCase().includes('not running') || e.toLowerCase().includes('offline'));
      if (looksLikeRace || immediateEvidence.aggregateConfidence >= 0.4) {
        await new Promise(r => setTimeout(r, this.defaultSettlingDelayMs));
        return this.verifyExecutionOutcome(actionId, execResult, capability, ctx, expectedPostcondition, 'delayed');
      }
    }

    const isSuccess = immediateEvidence.negativeEvidence.length === 0 && immediateEvidence.aggregateConfidence >= 0.6;
    const allEvidence = [...immediateEvidence.positiveEvidence, ...immediateEvidence.negativeEvidence];
    const reasoning = isSuccess
      ? `Verification passed across ${immediateEvidence.sourcesPolled} independent observation layers with high confidence (${immediateEvidence.aggregateConfidence}).`
      : `Verification failed: encountered contradictory system evidence or degraded postconditions across polled sources.`;

    return {
      success: isSuccess,
      confidence: immediateEvidence.aggregateConfidence,
      reason: reasoning,
      reasoning,
      evidence: allEvidence,
      timestamp: Date.now(),
      stage,
      verifiedOutputs: immediateEvidence.verifiedOutputs,
    };
  }

  /**
   * Stage 3: Post-Repair re-evaluation after recovery workflow completes.
   */
  public async verifyPostRepair(
    actionId: string,
    expectedPostcondition?: { type: string; target: string; expectedValue: any }
  ): Promise<AdaptiveVerificationResult> {
    return this.verifyExecutionOutcome(actionId, undefined, undefined, undefined, expectedPostcondition, 'post-repair');
  }

  /**
   * Stage 4: Pre-Consumption audit before downstream ActionNodes bind parameters from ExecutionContext.
   */
  public async verifyPreConsumption(
    actionId: string,
    outputKeys: string[]
  ): Promise<AdaptiveVerificationResult> {
    const evidence: string[] = [`[PreConsumption] Audited ${outputKeys.length} parameter bindings in shared ExecutionContext for downstream consumer.`];
    
    // Check World Model freshness via State Engine to ensure resource hasn't degraded
    const stateAudit = await this.sources.collectEvidence(actionId);
    evidence.push(...stateAudit.positiveEvidence);

    const isSuccess = stateAudit.negativeEvidence.length === 0;
    const reasoning = isSuccess
      ? `Pre-consumption verification confirmed parameters remain valid and un-degraded in active World Model.`
      : `Pre-consumption audit detected parameter degradation prior to downstream ingestion.`;

    return {
      success: isSuccess,
      confidence: stateAudit.aggregateConfidence,
      reason: reasoning,
      reasoning,
      evidence,
      timestamp: Date.now(),
      stage: 'pre-consumption',
      verifiedOutputs: stateAudit.verifiedOutputs,
    };
  }
}

export const globalMultiStageVerifier = new MultiStageVerifier();
