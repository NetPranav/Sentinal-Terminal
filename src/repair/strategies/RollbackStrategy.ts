/**
 * RollbackStrategy.ts — Automated State Reversion Recovery
 *
 * Deployed when an action failure leaves the operating system in an inconsistent or partially modified state.
 * Generates a logical recovery workflow invoking Phase 5 RollbackEngine to restore clean previous snapshot conditions.
 */

import { IRepairStrategy } from './IRepairStrategy';
import { FailureCategory, FailureDiagnosis } from '../models/FailureClassification';
import { RepairGraph } from '../models/RepairTypes';
import { RepairGraphBuilder } from '../repair/RepairGraph';

export class RollbackStrategy implements IRepairStrategy {
  readonly name = 'RollbackStrategy';
  readonly description = 'Reverts partial mutations and restores clean system state via RollbackEngine';
  readonly supportedCategories: FailureCategory[] = ['Permission', 'MissingResource', 'ApplicationState', 'Unknown', 'Timeout'];
  readonly requiresUserConfirmation = false;

  public canHandle(diagnosis: FailureDiagnosis): boolean {
    // Rollback is valid for both recoverable and unrecoverable partial faults
    return this.supportedCategories.includes(diagnosis.category);
  }

  public async generatePlan(
    diagnosis: FailureDiagnosis,
    targetActionId: string,
    actionParameters: Record<string, unknown> = {}
  ): Promise<RepairGraph> {
    const builder = new RepairGraphBuilder(targetActionId, diagnosis, this.name);

    // Step 1: Execute logical session rollback Action
    const rollbackNode = builder.addLogicalAction(
      'session.state.rollback',
      `Execute atomic rollback to revert partial system mutations from failed action [${targetActionId}]`,
      { targetActionId, reason: diagnosis.errorMessage }
    );

    // Step 2: Verify state restored to clean previous snapshot
    builder.addLogicalAction(
      'system.verify.state',
      `Verify World Model snapshot restoration following atomic rollback`,
      { expectedClean: true },
      [rollbackNode]
    );

    return builder.build();
  }
}

export const defaultRollbackStrategy = new RollbackStrategy();
