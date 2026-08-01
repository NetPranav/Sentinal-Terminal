import { GoalNode } from './PlannerTypes';
import { NormalizedGoal } from '../conversation/ConversationTypes';

export class PlannerMemory {
  // Goal ID -> JSON serialized array of GoalNodes
  private cache: Map<NormalizedGoal, string> = new Map();
  private hitCount = 0;

  /**
   * Retrieves a previously generated decomposition for a canonical goal.
   * Returns a deeply cloned array of GoalNodes to prevent reference pollution.
   */
  public get(goal: NormalizedGoal): GoalNode[] | null {
    const cached = this.cache.get(goal);
    if (cached) {
      this.hitCount++;
      return JSON.parse(cached) as GoalNode[];
    }
    return null;
  }

  /**
   * Saves a decomposition into memory.
   */
  public set(goal: NormalizedGoal, nodes: GoalNode[]): void {
    // Only cache if there's no missing entities and it's highly confident
    const isHighConfidence = nodes.every(n => n.confidence > 0.8 && n.planningState !== 'blocked');
    if (isHighConfidence) {
      this.cache.set(goal, JSON.stringify(nodes));
    }
  }

  public getHitCount(): number {
    return this.hitCount;
  }
  
  public clear(): void {
    this.cache.clear();
    this.hitCount = 0;
  }
}
