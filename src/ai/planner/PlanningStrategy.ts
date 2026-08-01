import { PlannerContext } from './PlannerContext';
import { GoalNode } from './PlannerTypes';

/**
 * Implements high-level planning strategies:
 * - Conditional Planning: Skipping nodes that are already satisfied.
 * - Hierarchical Planning: Linking parent and child nodes.
 */
export class PlanningStrategy {
  constructor(private context: PlannerContext) {}

  /**
   * Applies planning strategies to a set of nodes.
   * Modifies node states (e.g., marks 'satisfied') based on system state.
   */
  public applyStrategy(nodes: GoalNode[]): GoalNode[] {
    const activeNodes = [...nodes];
    
    // Evaluate conditions against System State
    for (const node of activeNodes) {
      if (this.context.isGoalSatisfied(node.goal)) {
        node.planningState = 'satisfied';
        node.reasoning += ' [Skipped: Goal already satisfied by system state]';
      }
    }

    // Optional: Prune nodes that are satisfied and have no unsatisfied dependents
    // For Phase 2, we leave them in the graph as 'satisfied' for visibility,
    // and the execution engine will just skip them.
    
    return activeNodes;
  }
}
