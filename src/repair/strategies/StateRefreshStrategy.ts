/**
 * StateRefreshStrategy.ts — World Model Synchronization & Cache Expiration Recovery
 *
 * Resolves failures stemming from stale State Engine caches or unsynchronized OS mutations
 * by forcing an authoritative collector harvest before re-running the primary logical action.
 */

import { IRepairStrategy } from './IRepairStrategy';
import { FailureCategory, FailureDiagnosis } from '../models/FailureClassification';
import { RepairGraph } from '../models/RepairTypes';
import { RepairGraphBuilder } from '../repair/RepairGraph';

export class StateRefreshStrategy implements IRepairStrategy {
  readonly name = 'StateRefreshStrategy';
  readonly description = 'Forces State Engine cache invalidation and live system harvesting prior to re-execution';
  readonly supportedCategories: FailureCategory[] = ['Network', 'ApplicationState', 'MissingResource', 'RaceCondition'];
  readonly requiresUserConfirmation = false;

  public canHandle(diagnosis: FailureDiagnosis): boolean {
    return this.supportedCategories.includes(diagnosis.category) && diagnosis.recoverable;
  }

  public async generatePlan(
    diagnosis: FailureDiagnosis,
    targetActionId: string,
    actionParameters: Record<string, unknown> = {}
  ): Promise<RepairGraph> {
    const builder = new RepairGraphBuilder(targetActionId, diagnosis, this.name);
    
    // Step 1: Force State Engine World Model refresh
    const refreshNode = builder.addLogicalAction(
      'state.engine.refresh',
      'Force authoritative State Engine harvest and evict stale cache entries for target domain',
      { targetDomain: targetActionId.split('.')[0] || 'system', reason: diagnosis.errorMessage }
    );

    // Step 2: Re-execute target logical Action against freshly synchronized World Model
    const retryNode = builder.addLogicalAction(
      targetActionId,
      `Re-execute primary action [${targetActionId}] using freshly validated State Engine context`,
      { ...actionParameters, _stateRefreshed: true },
      [refreshNode]
    );

    // Step 3: Verify execution outcome
    builder.addLogicalAction(
      'system.verify.state',
      `Verify postconditions of action [${targetActionId}] after state synchronization`,
      { actionId: targetActionId },
      [retryNode]
    );

    return builder.build();
  }
}

export const defaultStateRefreshStrategy = new StateRefreshStrategy();
