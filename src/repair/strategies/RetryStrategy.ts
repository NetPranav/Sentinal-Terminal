/**
 * RetryStrategy.ts — Flexible Retry Strategy Supporting Multiple Policies
 *
 * Support immediate, delayed, exponential backoff, dependency-triggered, and user approval retries
 * without embedding fixed magic numbers into capability implementations.
 */

import { IRepairStrategy } from './IRepairStrategy';
import { FailureCategory, FailureDiagnosis } from '../models/FailureClassification';
import { RepairGraph, RetryPolicy, RetryMode } from '../models/RepairTypes';
import { RepairGraphBuilder } from '../repair/RepairGraph';

export class RetryStrategy implements IRepairStrategy {
  readonly name = 'RetryStrategy';
  readonly description = 'Executes multi-mode automated retry recovery with settling delay or exponential backoff';
  readonly supportedCategories: FailureCategory[] = ['Timeout', 'RaceCondition', 'Network', 'ApplicationState'];
  readonly requiresUserConfirmation: boolean;
  readonly policy: RetryPolicy;

  constructor(policy: RetryPolicy = { mode: 'exponential-backoff', maxAttempts: 3, baseDelayMs: 250, maxDelayMs: 2000 }) {
    this.policy = policy;
    this.requiresUserConfirmation = policy.mode === 'user-approval' || !!policy.requireUserConfirmation;
  }

  public canHandle(diagnosis: FailureDiagnosis): boolean {
    return this.supportedCategories.includes(diagnosis.category) && diagnosis.recoverable;
  }

  public async generatePlan(
    diagnosis: FailureDiagnosis,
    targetActionId: string,
    actionParameters: Record<string, unknown> = {}
  ): Promise<RepairGraph> {
    const builder = new RepairGraphBuilder(targetActionId, diagnosis, `${this.name} (${this.policy.mode})`);
    
    let delayMs = this.policy.baseDelayMs;
    if (this.policy.mode === 'immediate') {
      delayMs = 0;
    } else if (this.policy.mode === 'exponential-backoff') {
      delayMs = Math.min(this.policy.baseDelayMs * 2, this.policy.maxDelayMs || 5000);
    }

    // Step 1: Optional logical settling pause or dependency check if not immediate
    let lastNodeId: string | undefined;
    if (delayMs > 0 && this.policy.mode !== 'dependency-triggered') {
      lastNodeId = builder.addLogicalAction(
        'system.delay',
        `Apply settling delay of ${delayMs}ms before attempting action retry`,
        { durationMs: delayMs, reason: diagnosis.errorMessage }
      );
    } else if (this.policy.mode === 'dependency-triggered') {
      lastNodeId = builder.addLogicalAction(
        'system.verify.dependency',
        'Verify required system daemon or resource lock has been released before retry',
        { target: targetActionId }
      );
    }

    // Step 2: Re-execute target action with identical parameter schema
    const retryNode = builder.addLogicalAction(
      targetActionId,
      `Retry primary logical action [${targetActionId}] after fault diagnosis`,
      { ...actionParameters, _isRetryAttempt: true, _retryMode: this.policy.mode },
      lastNodeId ? [lastNodeId] : []
    );

    // Step 3: Post-repair verification node
    builder.addLogicalAction(
      'system.verify.state',
      `Verify postconditions of retried action [${targetActionId}]`,
      { actionId: targetActionId },
      [retryNode]
    );

    return builder.build();
  }
}

export const defaultRetryStrategy = new RetryStrategy();
