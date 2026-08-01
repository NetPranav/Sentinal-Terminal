/**
 * ActionSearch.ts — Hybrid ranked retrieval pipeline
 *
 * Ranking order:
 * 1. Exact ID match
 * 2. Alias match
 * 3. Entity match
 * 4. Category match
 * 5. Tag match
 * 6. Capability match
 * 7. Semantic (substring) match
 *
 * Returns ScoredAction[] sorted by descending score.
 */

import { ActionDefinition, ScoredAction } from '../models/ActionTypes';
import { ActionRegistry } from '../registry/ActionRegistry';

export class ActionSearch {
  constructor(private registry: ActionRegistry) {}

  /**
   * Search for actions matching a query string.
   * Returns scored results sorted by relevance.
   */
  public search(query: string, limit: number = 10): ScoredAction[] {
    const normalizedQuery = query.toLowerCase().trim();
    const results: Map<string, ScoredAction> = new Map();

    // 1. Exact ID match (score: 1.0)
    const exactMatch = this.registry.getById(normalizedQuery);
    if (exactMatch) {
      results.set(exactMatch.id, { action: exactMatch, score: 1.0, matchType: 'exact' });
    }

    // 2. Alias match (score: 0.9)
    const aliasMatches = this.registry.getByAlias(normalizedQuery);
    for (const action of aliasMatches) {
      if (!results.has(action.id)) {
        results.set(action.id, { action, score: 0.9, matchType: 'alias' });
      }
    }

    // 3. Entity match (score: 0.7)
    // Check if query looks like an entity type
    const entityMatches = this.registry.getByEntity(normalizedQuery as any);
    for (const action of entityMatches) {
      if (!results.has(action.id)) {
        results.set(action.id, { action, score: 0.7, matchType: 'entity' });
      }
    }

    // 4. Category match (score: 0.6)
    const categoryMatches = this.registry.getByCategory(normalizedQuery);
    for (const action of categoryMatches) {
      if (!results.has(action.id)) {
        results.set(action.id, { action, score: 0.6, matchType: 'category' });
      }
    }

    // 5. Tag match (score: 0.5)
    const tagMatches = this.registry.getByTag(normalizedQuery);
    for (const action of tagMatches) {
      if (!results.has(action.id)) {
        results.set(action.id, { action, score: 0.5, matchType: 'tag' });
      }
    }

    // 6. Capability match (score: 0.4)
    const allActions = this.registry.getAll();
    for (const action of allActions) {
      if (results.has(action.id)) continue;
      const capabilityMatch = action.capabilities.some(
        c => c.name.toLowerCase().includes(normalizedQuery)
      );
      if (capabilityMatch) {
        results.set(action.id, { action, score: 0.4, matchType: 'capability' });
      }
    }

    // 7. Semantic (substring) match on displayName, summary, shortDescription (score: 0.3)
    for (const action of allActions) {
      if (results.has(action.id)) continue;
      const searchableText = [
        action.displayName,
        action.summary,
        action.shortDescription,
        ...action.tags,
        ...action.aliases,
      ].join(' ').toLowerCase();

      if (searchableText.includes(normalizedQuery)) {
        results.set(action.id, { action, score: 0.3, matchType: 'semantic' });
      }
    }

    // Sort by descending score and limit
    return Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find the best single match for a goal ID.
   * Returns null if no match found.
   */
  public findBestMatch(goalId: string): ScoredAction | null {
    const results = this.search(goalId, 1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Find all candidates for a goal ID with scores above the threshold.
   */
  public findCandidates(goalId: string, threshold: number = 0.3): ScoredAction[] {
    return this.search(goalId).filter(r => r.score >= threshold);
  }
}
