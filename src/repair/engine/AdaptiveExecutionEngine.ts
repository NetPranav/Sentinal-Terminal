/**
 * AdaptiveExecutionEngine.ts — Resilient Runtime Execution Layer
 *
 * Implements adaptive self-healing as an additional execution orchestration layer around the
 * deterministic Phase 4 Runtime. The Planner generates identical ActionGraphs; this engine
 * ensures execution resilience by combining multi-stage verification with automated self-repair.
 */

import { AdaptiveVerificationEngine, globalAdaptiveVerificationEngine } from '../verification/AdaptiveVerificationEngine';
import { RepairPlanner, globalRepairPlanner } from '../repair/RepairPlanner';
import { RecoveryEngine, globalRecoveryEngine } from './RecoveryEngine';
import { AdaptiveVerificationResult, RecoveryResult } from '../models/RepairTypes';
import { RepairTelemetry, globalRepairTelemetry } from '../telemetry/RepairTelemetry';
import { ICapability, CapabilityContext, CapabilityResult } from '../../sdk/capabilities/CapabilityTypes';

export interface ResilientExecutionOutcome {
  readonly actionId: string;
  readonly success: boolean;
  readonly verification: AdaptiveVerificationResult;
  readonly recovery?: RecoveryResult;
  readonly totalExecutionTimeMs: number;
  readonly verifiedOutputs: Record<string, unknown>;
  readonly error?: string;
}

export class AdaptiveExecutionEngine {
  private verifier: AdaptiveVerificationEngine;
  private planner: RepairPlanner;
  private recoveryEngine: RecoveryEngine;
  private telemetry: RepairTelemetry;

  constructor(
    verifier: AdaptiveVerificationEngine = globalAdaptiveVerificationEngine,
    planner: RepairPlanner = globalRepairPlanner,
    recoveryEngine: RecoveryEngine = globalRecoveryEngine,
    telemetry: RepairTelemetry = globalRepairTelemetry
  ) {
    this.verifier = verifier;
    this.planner = planner;
    this.recoveryEngine = recoveryEngine;
    this.telemetry = telemetry;
  }

  /**
   * Execute an Action with full resilient multi-stage verification and automated repair.
   * Does not modify deterministic Planner architecture; acts as an intelligent runtime wrapper.
   */
  public async executeWithResilience(
    actionId: string,
    executeCallback: () => Promise<CapabilityResult>,
    capability?: ICapability,
    ctx?: CapabilityContext,
    expectedPostcondition?: { type: string; target: string; expectedValue: any },
    preferredRepairStrategy?: string
  ): Promise<ResilientExecutionOutcome> {
    const start = performance.now();
    let execResult: CapabilityResult | undefined;
    let initialError: string | undefined;

    // 1. Primary Action Execution
    try {
      execResult = await executeCallback();
      if (!execResult.success && execResult.error) {
        initialError = execResult.error;
      }
    } catch (err: any) {
      initialError = err?.message || String(err);
    }

    // 2. Stage 1 & 2: Immediate & Delayed Settling Verification Audit
    const verif = await this.verifier.verifyAction(actionId, execResult, capability, ctx, expectedPostcondition, 'immediate');
    this.telemetry.recordVerification(verif.success);

    // If verification succeeded on primary attempt, return clean resilient outcome immediately
    if (verif.success && !initialError) {
      const totalExecutionTimeMs = Math.round((performance.now() - start) * 100) / 100;
      return {
        actionId,
        success: true,
        verification: verif,
        totalExecutionTimeMs,
        verifiedOutputs: verif.verifiedOutputs,
      };
    }

    // 3. Verification Failed: Initiate Self-Repair Planning Loop
    const failureReason = initialError || verif.reason || 'Postcondition validation mismatch';
    const params = ctx?.actionNode?.inputs || {};
    const { plan, diagnosis } = await this.planner.planRepair(actionId, failureReason, params, preferredRepairStrategy);

    if (!plan) {
      const totalExecutionTimeMs = Math.round((performance.now() - start) * 100) / 100;
      return {
        actionId,
        success: false,
        verification: verif,
        totalExecutionTimeMs,
        verifiedOutputs: {},
        error: `Unrecoverable execution fault (${diagnosis.category}): ${failureReason}`,
      };
    }

    // 4. Stage 3: Execute logical RepairGraph and run Post-Repair re-verification
    const recovery = await this.recoveryEngine.executeRepair(plan, expectedPostcondition);
    const totalExecutionTimeMs = Math.round((performance.now() - start) * 100) / 100;

    return {
      actionId,
      success: recovery.success,
      verification: recovery.verification,
      recovery,
      totalExecutionTimeMs,
      verifiedOutputs: recovery.verification.verifiedOutputs,
      error: recovery.success ? undefined : `Automated self-healing exhausted (${recovery.resolutionStrategy}): ${recovery.error}`,
    };
  }

  /**
   * Stage 4: Pre-Consumption audit before downstream nodes bind parameters from shared context.
   */
  public async auditBeforeConsumption(actionId: string, requiredKeys: string[]): Promise<AdaptiveVerificationResult> {
    return this.verifier.verifyPreConsumption(actionId, requiredKeys);
  }
}

export const globalAdaptiveExecutionEngine = new AdaptiveExecutionEngine();
