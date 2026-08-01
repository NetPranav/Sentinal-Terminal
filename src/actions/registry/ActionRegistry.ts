/**
 * ActionRegistry.ts — Multi-index in-memory capability catalog
 *
 * Completely declarative. Zero execution logic.
 * Provides O(1) lookup by ID, and indexed lookups by alias, tag, category,
 * entity, platform, and constraint.
 */

import { ActionDefinition, SupportedPlatform } from '../models/ActionTypes';
import { EntityType } from '../../ai/conversation/ConversationTypes';

export class ActionRegistry {
  // Primary store
  private actions: Map<string, ActionDefinition> = new Map();

  // Indexes
  private aliasIndex: Map<string, string[]> = new Map();  // alias -> action IDs
  private tagIndex: Map<string, string[]> = new Map();    // tag -> action IDs
  private categoryIndex: Map<string, string[]> = new Map();  // category -> action IDs
  private entityIndex: Map<string, string[]> = new Map();    // entity type -> action IDs
  private platformIndex: Map<string, string[]> = new Map();  // platform -> action IDs
  private constraintIndex: Map<string, string[]> = new Map();  // constraint ID -> action IDs

  /**
   * Registers an ActionDefinition. Rejects duplicates.
   */
  public register(action: ActionDefinition): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Action '${action.id}' is already registered.`);
    }

    this.actions.set(action.id, action);
    this.indexAction(action);
  }

  /**
   * Unregisters an action by ID.
   */
  public unregister(id: string): boolean {
    const action = this.actions.get(id);
    if (!action) return false;

    this.actions.delete(id);
    this.removeFromIndexes(action);
    return true;
  }

  /**
   * Get action by exact ID. O(1).
   */
  public getById(id: string): ActionDefinition | undefined {
    return this.actions.get(id);
  }

  /**
   * Get all actions matching an alias (case-insensitive).
   */
  public getByAlias(alias: string): ActionDefinition[] {
    const normalizedAlias = alias.toLowerCase();
    const ids = this.aliasIndex.get(normalizedAlias) || [];
    return ids.map(id => this.actions.get(id)!).filter(Boolean);
  }

  /**
   * Get all actions matching a tag.
   */
  public getByTag(tag: string): ActionDefinition[] {
    const ids = this.tagIndex.get(tag.toLowerCase()) || [];
    return ids.map(id => this.actions.get(id)!).filter(Boolean);
  }

  /**
   * Get all actions in a category.
   */
  public getByCategory(category: string): ActionDefinition[] {
    const ids = this.categoryIndex.get(category.toLowerCase()) || [];
    return ids.map(id => this.actions.get(id)!).filter(Boolean);
  }

  /**
   * Get all actions that require or optionally accept an entity type.
   */
  public getByEntity(entityType: EntityType): ActionDefinition[] {
    const ids = this.entityIndex.get(entityType) || [];
    return ids.map(id => this.actions.get(id)!).filter(Boolean);
  }

  /**
   * Get all actions that support a specific platform.
   */
  public getByPlatform(platform: SupportedPlatform): ActionDefinition[] {
    const ids = this.platformIndex.get(platform) || [];
    return ids.map(id => this.actions.get(id)!).filter(Boolean);
  }

  /**
   * Get all actions that have a specific constraint.
   */
  public getByConstraint(constraintId: string): ActionDefinition[] {
    const ids = this.constraintIndex.get(constraintId) || [];
    return ids.map(id => this.actions.get(id)!).filter(Boolean);
  }

  /**
   * Returns all registered actions.
   */
  public getAll(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }

  /**
   * Returns the total count of registered actions.
   */
  public size(): number {
    return this.actions.size;
  }

  /**
   * Checks if an action ID exists.
   */
  public has(id: string): boolean {
    return this.actions.has(id);
  }

  /**
   * Clears all actions and indexes.
   */
  public clear(): void {
    this.actions.clear();
    this.aliasIndex.clear();
    this.tagIndex.clear();
    this.categoryIndex.clear();
    this.entityIndex.clear();
    this.platformIndex.clear();
    this.constraintIndex.clear();
  }

  // ── Index Management ──

  private indexAction(action: ActionDefinition): void {
    // Alias index
    for (const alias of action.aliases) {
      const key = alias.toLowerCase();
      this.appendToIndex(this.aliasIndex, key, action.id);
    }

    // Tag index
    for (const tag of action.tags) {
      this.appendToIndex(this.tagIndex, tag.toLowerCase(), action.id);
    }

    // Category index
    this.appendToIndex(this.categoryIndex, action.category.toLowerCase(), action.id);

    // Entity index
    for (const entity of [...action.requiredEntities, ...action.optionalEntities]) {
      this.appendToIndex(this.entityIndex, entity, action.id);
    }

    // Platform index
    for (const platform of action.supportedPlatforms) {
      this.appendToIndex(this.platformIndex, platform, action.id);
    }

    // Constraint index
    for (const constraint of action.constraints) {
      this.appendToIndex(this.constraintIndex, constraint.id, action.id);
    }
  }

  private removeFromIndexes(action: ActionDefinition): void {
    for (const alias of action.aliases) {
      this.removeFromIndex(this.aliasIndex, alias.toLowerCase(), action.id);
    }
    for (const tag of action.tags) {
      this.removeFromIndex(this.tagIndex, tag.toLowerCase(), action.id);
    }
    this.removeFromIndex(this.categoryIndex, action.category.toLowerCase(), action.id);
    for (const entity of [...action.requiredEntities, ...action.optionalEntities]) {
      this.removeFromIndex(this.entityIndex, entity, action.id);
    }
    for (const platform of action.supportedPlatforms) {
      this.removeFromIndex(this.platformIndex, platform, action.id);
    }
    for (const constraint of action.constraints) {
      this.removeFromIndex(this.constraintIndex, constraint.id, action.id);
    }
  }

  private appendToIndex(index: Map<string, string[]>, key: string, id: string): void {
    const arr = index.get(key) || [];
    if (!arr.includes(id)) {
      arr.push(id);
      index.set(key, arr);
    }
  }

  private removeFromIndex(index: Map<string, string[]>, key: string, id: string): void {
    const arr = index.get(key);
    if (arr) {
      const filtered = arr.filter(x => x !== id);
      if (filtered.length === 0) {
        index.delete(key);
      } else {
        index.set(key, filtered);
      }
    }
  }
}
