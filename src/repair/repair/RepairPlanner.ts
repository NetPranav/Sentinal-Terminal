/**
 * RepairPlanner.ts — Logical Recovery Workflow Synthesizer
 *
 * Receives verification failures, analyzes root causes via structural taxonomy classification,
 * selects optimal recovery strategies, and synthesizes platform-independent logical RepairGraphs.
 * Never generates raw shell commands or modifies the primary deterministic execution plan.
 */

import { FailureClassifier, FailureDiagnosis } from '../models/FailureClassification';
import { RepairGraph } from '../models/RepairTypes';
import { StrategyRegistry, globalStrategyRegistry } from '../strategies/StrategyRegistry';
import { IRepairStrategy } from '../strategies/IRepairStrategy';

export class RepairPlanner {
  private registry: StrategyRegistry;

  constructor(registry: StrategyRegistry = globalStrategyRegistry) {
    this.registry = registry;
  }

  /**
   * Diagnose execution or verification error and synthesize a logical RepairGraph recovery plan.
   */
  public async planRepair(
    actionId: string,
    errorOrWarning: string | Error,
    actionParameters: Record<string, unknown> = {},
    preferredStrategyName?: string
  ): Promise<{ diagnosis: FailureDiagnosis; plan?: RepairGraph; strategyUsed?: IRepairStrategy }> {
    // 1. Classify root cause into structured taxonomy
    const diagnosis = FailureClassifier.classify(actionId, errorOrWarning, { parameters: actionParameters });

    if (!diagnosis.recoverable && diagnosis.category === 'UserCancellation') {
      return { diagnosis, plan: undefined };
    }

    // 2. Determine best matched self-healing strategies
    const candidates = await this.registry.getCandidates(diagnosis);
    if (candidates.length === 0) {
      return { diagnosis, plan: undefined };
    }

    let selected: IRepairStrategy = candidates[0];
    if (preferredStrategyName) {
      const found = candidates.find(c => c.name.toLowerCase().includes(preferredStrategyName.toLowerCase()));
      if (found) selected = found;
    }

    // 3. Synthesize logical Action recovery graph (NO shell commands!)
    const plan = await selected.generatePlan(diagnosis, actionId, actionParameters);

    return {
      diagnosis,
      plan,
      strategyUsed: selected,
    };
  }

  /**
   * Helper utility for creating specialized multi-step recovery workflows (such as Bluetooth radio toggling).
   */
  public async generateSpecializedGraph(
    targetActionId: string,
    errorMsg: string,
    strategyName = 'RetryStrategy'
  ): Promise<RepairGraph> {
    const { plan } = await this.planRepair(targetActionId, errorMsg, {}, strategyName);
    if (!plan) {
      throw new Error(`Unable to synthesize recovery plan for action [${targetActionId}]`);
    }
    return plan;
  }
}

export const globalRepairPlanner = new RepairPlanner();
