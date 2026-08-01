import { ConversationResult } from '../conversation/ConversationTypes';
import { GoalNode, PlanningState } from './PlannerTypes';
import { randomUUID } from 'crypto';

/**
 * Normalizes a ConversationResult into a canonical internal root GoalNode.
 * Keeps conversation normalization separated from task decomposition.
 */
export class GoalResolver {
  /**
   * Resolves a ConversationResult into the initial root GoalNode.
   */
  public resolve(result: ConversationResult): GoalNode {
    // Determine initial planning state
    let state: PlanningState = 'known';
    
    // If the conversation result has a very low confidence or unknown goal,
    // we mark it as unknown.
    if (result.goal.id === 'unknown.unknown' || result.confidence < 0.3) {
      state = 'unknown';
    } 
    
    if (result.ambiguities.length > 0) {
      // If there are ambiguities like missing entities, we start as blocked
      const missingEntity = result.ambiguities.find(a => a.type === 'missing_entity');
      if (missingEntity) {
        state = 'blocked';
      }
    }

    const node: GoalNode = {
      id: randomUUID(),
      title: this.generateTitle(result.goal.id),
      description: result.goal.raw,
      goal: result.goal.id,
      dependencies: [],
      requiredEntities: [], // To be populated by decomposer/validator
      boundEntities: [...result.entities],
      planningState: state,
      reasoning: 'Root goal extracted from user conversation.',
      confidence: result.confidence,
      platformIndependent: true,
    };

    return node;
  }

  /**
   * Generates a human-readable title from a domain.action string.
   */
  private generateTitle(goalId: string): string {
    const parts = goalId.split('.');
    if (parts.length !== 2) return goalId;
    
    const [domain, action] = parts;
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
    return `${capitalize(action)} ${capitalize(domain)}`;
  }
}
