/**
 * DependencyRepairStrategy.ts — Automated Dependency & Resource Provisioning Strategy
 *
 * Resolves missing CLI utilities, package binaries, or system daemons by generating logical
 * package installation or service activation nodes before re-triggering the workflow.
 */

import { IRepairStrategy } from './IRepairStrategy';
import { FailureCategory, FailureDiagnosis } from '../models/FailureClassification';
import { RepairGraph } from '../models/RepairTypes';
import { RepairGraphBuilder } from '../repair/RepairGraph';

export class DependencyRepairStrategy implements IRepairStrategy {
  readonly name = 'DependencyRepairStrategy';
  readonly description = 'Provisions missing dependencies, packages, or running daemons required by target action';
  readonly supportedCategories: FailureCategory[] = ['Dependency', 'MissingResource'];
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
    
    // Determine missing binary or daemon from diagnosis details or action domain
    const targetDomain = targetActionId.split('.')[0] || 'package';
    let depAction = 'package.install';
    let depParam = { package: targetDomain };

    if (targetDomain === 'docker') {
      depAction = 'docker.daemon.start';
      depParam = { background: true } as any;
    } else if (targetDomain === 'python') {
      depAction = 'python.pip.install';
      depParam = { package: 'requirements.txt' } as any;
    }

    // Step 1: Execute logical dependency installation/start Action
    const provisionNode = builder.addLogicalAction(
      depAction,
      `Provision missing dependency via logical action [${depAction}]`,
      { ...depParam, reason: diagnosis.errorMessage }
    );

    // Step 2: Verify dependency exists in State Engine World Model
    const verifyDepNode = builder.addLogicalAction(
      'system.verify.dependency',
      `Verify provisioned binary is operational in system environment`,
      { target: depAction },
      [provisionNode]
    );

    // Step 3: Re-try primary logical Action
    const retryNode = builder.addLogicalAction(
      targetActionId,
      `Execute primary action [${targetActionId}] now that dependencies are satisfied`,
      { ...actionParameters, _dependencyProvisioned: true },
      [verifyDepNode]
    );

    // Step 4: Verify final postconditions
    builder.addLogicalAction(
      'system.verify.state',
      `Verify completion of primary action after dependency recovery`,
      { actionId: targetActionId },
      [retryNode]
    );

    return builder.build();
  }
}

export const defaultDependencyRepairStrategy = new DependencyRepairStrategy();
