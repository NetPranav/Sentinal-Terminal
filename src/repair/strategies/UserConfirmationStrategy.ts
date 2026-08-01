/**
 * UserConfirmationStrategy.ts — Interactive User Consultation Strategy
 *
 * Deployed when automated recovery implies destructive side effects or significant ambiguity.
 * Pauses automated resilience to acquire explicit user verification before executing repair graphs.
 */

import { IRepairStrategy } from './IRepairStrategy';
import { FailureCategory, FailureDiagnosis } from '../models/FailureClassification';
import { RepairGraph } from '../models/RepairTypes';
import { RepairGraphBuilder } from '../repair/RepairGraph';

export class UserConfirmationStrategy implements IRepairStrategy {
  readonly name = 'UserConfirmationStrategy';
  readonly description = 'Requests interactive user verification prior to proceeding with high-impact recovery actions';
  readonly supportedCategories: FailureCategory[] = ['Permission', 'MissingResource', 'ApplicationState', 'Unknown'];
  readonly requiresUserConfirmation = true;

  public canHandle(diagnosis: FailureDiagnosis): boolean {
    return this.supportedCategories.includes(diagnosis.category) && diagnosis.recoverable;
  }

  public async generatePlan(
    diagnosis: FailureDiagnosis,
    targetActionId: string,
    actionParameters: Record<string, unknown> = {}
  ): Promise<RepairGraph> {
    const builder = new RepairGraphBuilder(targetActionId, diagnosis, this.name);

    // Step 1: Interactive prompt action node
    const promptNode = builder.addLogicalAction(
      'user.interactive.confirm',
      `Acquire user approval to proceed with recovery for action [${targetActionId}]`,
      { failure: diagnosis.errorMessage, proposedAction: targetActionId, remedyHint: diagnosis.remedyHint }
    );

    // Step 2: Retry target action after explicit approval
    const retryNode = builder.addLogicalAction(
      targetActionId,
      `Execute primary action [${targetActionId}] following user approval`,
      { ...actionParameters, _userConfirmed: true },
      [promptNode]
    );

    // Step 3: Verify execution outcome
    builder.addLogicalAction(
      'system.verify.state',
      `Verify completion of action [${targetActionId}]`,
      { actionId: targetActionId },
      [retryNode]
    );

    return builder.build();
  }
}

export const defaultUserConfirmationStrategy = new UserConfirmationStrategy();
