import { ExecutionPlan, GoalNode, MissingEntityInfo } from './PlannerTypes';
import { EntityType } from '../conversation/ConversationTypes';

export class PlanValidator {
  /**
   * Validates the plan and updates the plan status/confidence.
   * Checks for missing entities based on bound vs required entities.
   */
  public validate(plan: ExecutionPlan): void {
    if (plan.nodes.length === 0) {
      throw new Error('Plan is empty');
    }

    const providedEntities = new Set<string>();

    for (const node of plan.nodes) {
      // Gather all entities available to this node
      for (const e of node.boundEntities) {
        providedEntities.add(e.type);
      }

      // Check against required entities
      for (const req of node.requiredEntities) {
        if (!providedEntities.has(req)) {
          // If required entity is missing, node is blocked
          node.planningState = 'blocked';
          node.reasoning += ` [Blocked: Missing required entity '${req}']`;
          
          plan.missingEntities.push({
            type: req as EntityType,
            reason: `Required to fulfill goal '${node.goal}'`,
            blockedNodeId: node.id
          });
        }
      }
    }

    if (plan.missingEntities.length > 0) {
      plan.isComplete = false;
      // Penalize overall confidence when entities are missing
      plan.overallConfidence = Math.max(0, plan.overallConfidence - 0.4);
    } else {
      plan.isComplete = true;
    }

    // Check if any node is blocked or unknown
    if (plan.nodes.some(n => n.planningState === 'blocked' || n.planningState === 'unknown')) {
      plan.isComplete = false;
    }
    
    // Check if confidence is critically low
    if (plan.overallConfidence < 0.2) {
      plan.isComplete = false; // Not confident enough to execute
    }
  }
}
