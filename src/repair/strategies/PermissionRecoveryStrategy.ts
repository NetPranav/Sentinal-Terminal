/**
 * PermissionRecoveryStrategy.ts — OS Permission & Privilege Recovery Strategy
 *
 * Resolves access denials by generating explicit permission audit checkpoints and guidance instructions
 * for Full Disk Access, Accessibility, or administrative privileges via Phase 5 PermissionManager.
 */

import { IRepairStrategy } from './IRepairStrategy';
import { FailureCategory, FailureDiagnosis } from '../models/FailureClassification';
import { RepairGraph } from '../models/RepairTypes';
import { RepairGraphBuilder } from '../repair/RepairGraph';

export class PermissionRecoveryStrategy implements IRepairStrategy {
  readonly name = 'PermissionRecoveryStrategy';
  readonly description = 'Requests necessary macOS authorizations and verifies privileges via PermissionManager';
  readonly supportedCategories: FailureCategory[] = ['Permission'];
  readonly requiresUserConfirmation = true; // Permission escalation always warrants user interactive awareness

  public canHandle(diagnosis: FailureDiagnosis): boolean {
    return diagnosis.category === 'Permission';
  }

  public async generatePlan(
    diagnosis: FailureDiagnosis,
    targetActionId: string,
    actionParameters: Record<string, unknown> = {}
  ): Promise<RepairGraph> {
    const builder = new RepairGraphBuilder(targetActionId, diagnosis, this.name);

    // Step 1: Execute logical permission request / authorization prompt Action
    const authNode = builder.addLogicalAction(
      'security.permission.request',
      `Prompt user for macOS access authorization required by action [${targetActionId}]`,
      { capabilityId: targetActionId, reason: diagnosis.errorMessage, remedyHint: diagnosis.remedyHint }
    );

    // Step 2: Re-try primary Action after permission is granted
    const retryNode = builder.addLogicalAction(
      targetActionId,
      `Execute primary action [${targetActionId}] with newly authorized system permissions`,
      { ...actionParameters, _permissionAuthorized: true },
      [authNode]
    );

    // Step 3: Verify execution outcome
    builder.addLogicalAction(
      'system.verify.state',
      `Verify postconditions of action [${targetActionId}] after permission authorization`,
      { actionId: targetActionId },
      [retryNode]
    );

    return builder.build();
  }
}

export const defaultPermissionRecoveryStrategy = new PermissionRecoveryStrategy();
