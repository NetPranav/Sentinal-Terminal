/**
 * AdaptiveVerificationEngine.ts — Central Verification Authority
 *
 * Coordinates multi-stage verification and evidence triangulation so the Execution Runtime
 * never blindly assumes action success based solely on exit codes or return values.
 */

import { AdaptiveVerificationResult, VerificationStage } from '../models/RepairTypes';
import { MultiStageVerifier, globalMultiStageVerifier } from './MultiStageVerifier';
import { ICapability, CapabilityContext, CapabilityResult } from '../../sdk/capabilities/CapabilityTypes';

export class AdaptiveVerificationEngine {
  private verifier: MultiStageVerifier;

  constructor(verifier: MultiStageVerifier = globalMultiStageVerifier) {
    this.verifier = verifier;
  }

  /**
   * Primary entry point called by the Runtime immediately upon capability execution return.
   * Synthesizes capability verifications, State Engine queries, runtime events, and execution outputs.
   */
  public async verifyAction(
    actionId: string,
    execResult?: CapabilityResult,
    capability?: ICapability,
    ctx?: CapabilityContext,
    expectedPostcondition?: { type: string; target: string; expectedValue: any },
    stage: VerificationStage = 'immediate'
  ): Promise<AdaptiveVerificationResult> {
    return this.verifier.verifyExecutionOutcome(actionId, execResult, capability, ctx, expectedPostcondition, stage);
  }

  /**
   * Audit executed after a RepairGraph finishes, confirming whether recovery restored target system state.
   */
  public async verifyPostRepair(
    actionId: string,
    expectedPostcondition?: { type: string; target: string; expectedValue: any }
  ): Promise<AdaptiveVerificationResult> {
    return this.verifier.verifyPostRepair(actionId, expectedPostcondition);
  }

  /**
   * Checkpoint executed before a downstream node consumes published outputs from ExecutionContext.
   */
  public async verifyPreConsumption(
    actionId: string,
    outputKeys: string[]
  ): Promise<AdaptiveVerificationResult> {
    return this.verifier.verifyPreConsumption(actionId, outputKeys);
  }
}

export const globalAdaptiveVerificationEngine = new AdaptiveVerificationEngine();
