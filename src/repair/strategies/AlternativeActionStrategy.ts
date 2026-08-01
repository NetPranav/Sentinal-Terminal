/**
 * AlternativeActionStrategy.ts — Fallback Action Discovery Strategy
 *
 * When primary execution or resource manipulation fails, this strategy substitutes
 * an alternative logical action from the Phase 3 Action Registry to achieve the same goal.
 */

import { IRepairStrategy } from './IRepairStrategy';
import { FailureCategory, FailureDiagnosis } from '../models/FailureClassification';
import { RepairGraph } from '../models/RepairTypes';
import { RepairGraphBuilder } from '../repair/RepairGraph';

export class AlternativeActionStrategy implements IRepairStrategy {
  readonly name = 'AlternativeActionStrategy';
  readonly description = 'Substitutes fallback logical Actions from the registry to achieve equivalent operational goals';
  readonly supportedCategories: FailureCategory[] = ['MissingResource', 'ApplicationState', 'Unknown', 'Network'];
  readonly requiresUserConfirmation = false;

  private fallbackMappings: Record<string, string> = {
    'application.launch': 'application.activate',
    'application.close': 'process.kill',
    'network.wifi.connect': 'network.interface.restart',
    'filesystem.copy': 'filesystem.move_and_clone',
  };

  public canHandle(diagnosis: FailureDiagnosis): boolean {
    return this.supportedCategories.includes(diagnosis.category) && diagnosis.recoverable;
  }

  public async generatePlan(
    diagnosis: FailureDiagnosis,
    targetActionId: string,
    actionParameters: Record<string, unknown> = {}
  ): Promise<RepairGraph> {
    const builder = new RepairGraphBuilder(targetActionId, diagnosis, this.name);
    
    // Determine logical fallback action ID
    const fallbackActionId = this.fallbackMappings[targetActionId] || `${targetActionId}.fallback`;

    // Step 1: Execute substitute fallback Action
    const fallbackNode = builder.addLogicalAction(
      fallbackActionId,
      `Execute fallback alternative action [${fallbackActionId}] in place of failed primary action`,
      { ...actionParameters, _originalActionId: targetActionId, _recoveryReason: diagnosis.errorMessage }
    );

    // Step 2: Post-repair verification
    builder.addLogicalAction(
      'system.verify.state',
      `Verify postconditions of fallback action [${fallbackActionId}]`,
      { actionId: fallbackActionId, expectedEquivalentTo: targetActionId },
      [fallbackNode]
    );

    return builder.build();
  }
}

export const defaultAlternativeActionStrategy = new AlternativeActionStrategy();
