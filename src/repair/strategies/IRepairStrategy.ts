/**
 * IRepairStrategy.ts — Contract for Modular Self-Healing Strategies
 *
 * Each strategy is responsible for evaluating a specific class of operational failure
 * and generating a platform-independent logical RepairGraph to remedy the fault.
 */

import { FailureCategory, FailureDiagnosis } from '../models/FailureClassification';
import { RepairGraph } from '../models/RepairTypes';

export interface IRepairStrategy {
  readonly name: string;
  readonly description: string;
  readonly supportedCategories: FailureCategory[];
  readonly requiresUserConfirmation: boolean;

  /**
   * Evaluate whether this strategy is suitable for recovering from the diagnosed failure.
   */
  canHandle(diagnosis: FailureDiagnosis): boolean | Promise<boolean>;

  /**
   * Produce a logical RepairGraph composed of Action Registry nodes to resolve the fault.
   */
  generatePlan(
    diagnosis: FailureDiagnosis,
    targetActionId: string,
    actionParameters?: Record<string, unknown>
  ): Promise<RepairGraph>;
}
