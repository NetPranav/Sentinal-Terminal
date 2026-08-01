import { EntityType } from '../conversation/ConversationTypes';
import { CurrentSystemState, GoalNode } from './PlannerTypes';

/**
 * PlannerContext maintains the state during a planning session.
 * It tracks parent/child relationships, required missing entities,
 * and current system state provided externally.
 */
export class PlannerContext {
  private missingEntities: Map<EntityType, string> = new Map();
  private systemState: CurrentSystemState | null;

  constructor(systemState?: CurrentSystemState) {
    this.systemState = systemState || null;
  }

  /**
   * Registers a missing entity preventing a node from proceeding.
   */
  public addMissingEntity(type: EntityType, reason: string): void {
    if (!this.missingEntities.has(type)) {
      this.missingEntities.set(type, reason);
    }
  }

  /**
   * Returns all recorded missing entities.
   */
  public getMissingEntities(): { type: EntityType; reason: string }[] {
    return Array.from(this.missingEntities.entries()).map(([type, reason]) => ({
      type,
      reason,
    }));
  }

  /**
   * Clears all missing entities.
   */
  public clearMissingEntities(): void {
    this.missingEntities.clear();
  }

  /**
   * Gets the current system state if provided.
   */
  public getSystemState(): CurrentSystemState | null {
    return this.systemState;
  }

  /**
   * Checks if a goal is already satisfied according to the system state.
   */
  public isGoalSatisfied(goalId: string, parameters?: Record<string, any>): boolean {
    if (!this.systemState) return false;
    
    // For Phase 2, this is a mock implementation.
    // In Phase 4, the State Engine will resolve this dynamically.
    const stateVal = this.systemState.getState(goalId);
    if (stateVal === true) return true;
    
    return false;
  }
}
