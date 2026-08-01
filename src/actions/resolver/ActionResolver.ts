/**
 * ActionResolver.ts — Converts ExecutionPlan (GoalNodes) → ActionGraph (ActionNodes)
 *
 * Maps each GoalNode's goal ID to the best matching ActionDefinition.
 * NEVER guesses — returns structured ActionAmbiguity when candidates score similarly.
 */

import {
  ActionNode,
  ActionGraph,
  ActionAmbiguity,
  ScoredAction,
} from '../models/ActionTypes';
import { ExecutionPlan, GoalNode } from '../../ai/planner/PlannerTypes';
import { ActionSearch } from '../search/ActionSearch';

/** Threshold below which a top-match is considered ambiguous with the runner-up */
const AMBIGUITY_THRESHOLD = 0.1;

export class ActionResolver {
  constructor(private search: ActionSearch) {}

  /**
   * Resolves an ExecutionPlan into an ActionGraph.
   * Each GoalNode is mapped to the best-matching ActionDefinition.
   */
  public resolve(plan: ExecutionPlan): ActionGraph {
    const actionNodes: ActionNode[] = [];
    const unresolvedGoals: string[] = [];
    const ambiguities: ActionAmbiguity[] = [];

    for (const goalNode of plan.nodes) {
      // Skip satisfied nodes
      if (goalNode.planningState === 'satisfied') continue;

      const candidates = this.search.findCandidates(goalNode.goal, 0.3);

      if (candidates.length === 0) {
        unresolvedGoals.push(goalNode.id);
        continue;
      }

      // Check for ambiguity: if top two candidates are within the threshold, flag it
      if (candidates.length >= 2) {
        const scoreDiff = candidates[0].score - candidates[1].score;
        if (scoreDiff < AMBIGUITY_THRESHOLD) {
          ambiguities.push({
            goalNodeId: goalNode.id,
            goalId: goalNode.goal,
            candidates: candidates.slice(0, 3),
            message: `Multiple actions match '${goalNode.goal}' with similar confidence. Top candidates: ${candidates.slice(0, 3).map(c => c.action.id).join(', ')}`
          });
          // Still resolve to the top candidate, but flag the ambiguity
        }
      }

      const bestMatch = candidates[0];
      const actionNode = this.createActionNode(goalNode, bestMatch);
      actionNodes.push(actionNode);
    }

    // Build execution order from plan's topological order, filtered to resolved nodes
    const resolvedIds = new Set(actionNodes.map(n => n.id));
    const executionOrder = plan.topologicalOrder.filter(id => resolvedIds.has(id));
    const parallelGroups = plan.parallelGroups
      .map(group => group.filter(id => resolvedIds.has(id)))
      .filter(group => group.length > 0);

    // Compute overall confidence
    const confidences = actionNodes.map(n => n.confidence);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    return {
      nodes: actionNodes,
      executionOrder,
      parallelGroups,
      unresolvedGoals,
      ambiguities,
      confidence: avgConfidence,
    };
  }

  private createActionNode(goalNode: GoalNode, scored: ScoredAction): ActionNode {
    // Map bound entities to inputs
    const inputs: Record<string, unknown> = {};
    for (const entity of goalNode.boundEntities) {
      inputs[entity.type] = entity.value;
    }

    return {
      id: goalNode.id,
      action: scored.action,
      goalNode,
      inputs,
      dependencies: goalNode.dependencies.map(d => d.nodeId),
      parallelizable: goalNode.dependencies.length === 0,
      status: 'pending',
      confidence: scored.score * goalNode.confidence,
    };
  }
}
