/**
 * ConversationContext.ts — Pronoun Resolution & Reference Tracking
 *
 * Lightweight state manager that resolves follow-up references
 * like "it", "that", "them", "there", "the file", "the app".
 *
 * Tracks:
 * - Recent entities per type (last 5)
 * - Recent goals (last 5)
 * - Active subject entity
 * - Reference chains across turns
 *
 * Does NOT store:
 * - Execution results
 * - Shell output
 * - Workflow state
 */

import type {
  ConversationEntity,
  ConversationGoal,
  ConversationContextState,
  EntityType,
} from './ConversationTypes';

/** Max entities to retain per type */
const MAX_ENTITIES_PER_TYPE = 5;
/** Max goals to retain */
const MAX_GOALS = 5;

/** Pronouns and references that trigger resolution */
const PRONOUN_PATTERNS: { pattern: RegExp; resolveType: 'subject' | 'last_entity' }[] = [
  { pattern: /\b(?:it|this|that)\b/i, resolveType: 'subject' },
  { pattern: /\b(?:them|those|these)\b/i, resolveType: 'last_entity' },
  { pattern: /\b(?:there|here)\b/i, resolveType: 'last_entity' },
  { pattern: /\bthe\s+(?:file|folder|app|application|device|container|process|project|repo|repository|package)\b/i, resolveType: 'subject' },
];

/**
 * Resolution result when a pronoun or reference is resolved.
 */
export interface ResolvedReference {
  /** The original pronoun or reference text */
  original: string;
  /** The resolved entity it refers to */
  resolved: ConversationEntity;
  /** Confidence in the resolution */
  confidence: number;
}

export class ConversationContext {
  private entities: Map<EntityType, ConversationEntity[]> = new Map();
  private goals: ConversationGoal[] = [];
  private subject: ConversationEntity | null = null;
  private turnCount: number = 0;

  /**
   * Record a new turn — store its entities and goal for future reference.
   */
  public addTurn(goal: ConversationGoal, entities: ConversationEntity[]): void {
    this.turnCount++;

    // Store goal
    this.goals.unshift(goal);
    if (this.goals.length > MAX_GOALS) {
      this.goals.pop();
    }

    // Store entities by type
    for (const entity of entities) {
      const list = this.entities.get(entity.type) || [];
      list.unshift(entity);
      if (list.length > MAX_ENTITIES_PER_TYPE) {
        list.pop();
      }
      this.entities.set(entity.type, list);
    }

    // Update active subject — prefer the highest-confidence entity from this turn
    if (entities.length > 0) {
      const sorted = [...entities].sort((a, b) => b.confidence - a.confidence);
      this.subject = sorted[0];
    }
  }

  /**
   * Attempt to resolve pronouns and references in the given input.
   * Returns a list of resolutions found (may be empty if no pronouns).
   */
  public resolveReferences(input: string): ResolvedReference[] {
    const results: ResolvedReference[] = [];

    for (const { pattern, resolveType } of PRONOUN_PATTERNS) {
      const match = input.match(pattern);
      if (!match) continue;

      let resolved: ConversationEntity | null = null;
      let confidence = 0;

      if (resolveType === 'subject' && this.subject) {
        resolved = this.subject;
        confidence = 0.90;
      } else if (resolveType === 'last_entity') {
        // Find the most recent entity across all types
        resolved = this.getMostRecentEntity();
        confidence = 0.80;
      }

      // Try type-specific resolution for "the file", "the app", etc.
      const typeMatch = match[0].match(/\bthe\s+(file|folder|app|application|device|container|process|project|repo|repository|package)\b/i);
      if (typeMatch) {
        const typeMap: Record<string, EntityType> = {
          'file': 'file',
          'folder': 'folder',
          'app': 'application',
          'application': 'application',
          'device': 'bluetooth_device',
          'container': 'container',
          'process': 'process',
          'project': 'workspace',
          'repo': 'repository',
          'repository': 'repository',
          'package': 'package',
        };
        const entityType = typeMap[typeMatch[1].toLowerCase()];
        if (entityType) {
          const typed = this.getRecentEntitiesByType(entityType);
          if (typed.length > 0) {
            resolved = typed[0];
            confidence = 0.92;
          }
        }
      }

      if (resolved) {
        results.push({
          original: match[0],
          resolved,
          confidence,
        });
      }
    }

    return results;
  }

  /**
   * Apply resolved references to a user input string, replacing pronouns
   * with their resolved entity values.
   */
  public applyResolutions(input: string, resolutions: ResolvedReference[]): string {
    let resolved = input;
    for (const ref of resolutions) {
      resolved = resolved.replace(ref.original, ref.resolved.value);
    }
    return resolved;
  }

  /**
   * Get the most recent entity of a specific type.
   */
  public getRecentEntitiesByType(type: EntityType): ConversationEntity[] {
    return this.entities.get(type) || [];
  }

  /**
   * Get the most recent entity across all types.
   */
  public getMostRecentEntity(): ConversationEntity | null {
    let newest: ConversationEntity | null = null;
    // Since we always unshift, the first element of each type array is most recent.
    // We find the one that was added most recently by checking all types.
    for (const [, list] of this.entities) {
      if (list.length > 0) {
        if (!newest) {
          newest = list[0];
        }
        // Without timestamps on individual entities, we use the subject as the tiebreaker
      }
    }
    return newest || this.subject;
  }

  /**
   * Get the most recent goals.
   */
  public getRecentGoals(n: number = MAX_GOALS): ConversationGoal[] {
    return this.goals.slice(0, n);
  }

  /**
   * Get the current active subject entity.
   */
  public getActiveSubject(): ConversationEntity | null {
    return this.subject;
  }

  /**
   * Export the current context state as an immutable snapshot.
   */
  public getState(): ConversationContextState {
    return {
      recentEntities: new Map(this.entities),
      recentGoals: [...this.goals],
      activeSubject: this.subject ? { ...this.subject } : null,
      turnCount: this.turnCount,
    };
  }

  /**
   * Check if there's enough context to resolve pronouns.
   */
  public hasContext(): boolean {
    return this.turnCount > 0 && (this.subject !== null || this.entities.size > 0);
  }

  /**
   * Check if the input likely contains unresolved references.
   */
  public containsReferences(input: string): boolean {
    return PRONOUN_PATTERNS.some(({ pattern }) => pattern.test(input));
  }

  /**
   * Reset all context state.
   */
  public reset(): void {
    this.entities.clear();
    this.goals = [];
    this.subject = null;
    this.turnCount = 0;
  }
}
