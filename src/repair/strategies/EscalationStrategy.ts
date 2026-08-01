/**
 * EscalationStrategy.ts — Controlled Failure Escalation & Termination Strategy
 *
 * Terminal catch-all strategy invoked when automated recovery strategies are exhausted or disallowed.
 * Halts execution cleanly and packages structured diagnostic evidence for parent Planner or user review.
 */

import { IRepairStrategy } from './IRepairStrategy';
import { FailureCategory, FailureDiagnosis } from '../models/FailureClassification';
import { RepairGraph } from '../models/RepairTypes';
import { RepairGraphBuilder } from '../repair/RepairGraph';

export class EscalationStrategy implements IRepairStrategy {
  readonly name = 'EscalationStrategy';
  readonly description = 'Safely halts execution and escalates structured failure diagnosis without unconfirmed mutation';
  readonly supportedCategories: FailureCategory[] = ['Permission', 'Network', 'Timeout', 'Dependency', 'MissingResource', 'ApplicationState', 'RaceCondition', 'UserCancellation', 'Unknown'];
  readonly requiresUserConfirmation = false;

  public canHandle(diagnosis: FailureDiagnosis): boolean {
    return true; // Catch-all terminal strategy always accepts any failure
  }

  public async generatePlan(
    diagnosis: FailureDiagnosis,
    targetActionId: string,
    actionParameters: Record<string, unknown> = {}
  ): Promise<RepairGraph> {
    const builder = new RepairGraphBuilder(targetActionId, diagnosis, this.name);

    // Step 1: Logical escalation and reporting action node
    builder.addLogicalAction(
      'system.fault.escalate',
      `Escalate unrecoverable failure for action [${targetActionId}] to operator or parent planning level`,
      {
        actionId: targetActionId,
        category: diagnosis.category,
        errorMessage: diagnosis.errorMessage,
        remedyHint: diagnosis.remedyHint,
        recoverable: diagnosis.recoverable,
      }
    );

    return builder.build();
  }
}

export const defaultEscalationStrategy = new EscalationStrategy();
