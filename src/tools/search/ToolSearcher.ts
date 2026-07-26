/**
 * ToolSearcher.ts
 * 
 * Multi-dimensional semantic search across all registry indexes.
 * Given user input (or intent + entities), returns ranked tool matches.
 * 
 * Search dimensions (in priority order):
 * 1. Tool ID exact match (score: 1000)
 * 2. Alias exact match (score: 900)
 * 3. Domain + action match (score: 800)
 * 4. Tag match (score: 600)
 * 5. Knowledge index scored match (score: variable, up to 500)
 * 6. Description fuzzy match (score: up to 300)
 */

import { ToolRegistryState } from '../loader/ToolLoader';
import { LoadedTool } from '../schemas/ToolDefinitionSchema';

export interface SearchResult {
  tool: LoadedTool;
  score: number;
  matchReasons: string[];
}

export class ToolSearcher {
  constructor(private registry: ToolRegistryState) {}

  /**
   * Search for tools matching a natural language query.
   * Returns results sorted by score (highest first).
   */
  public search(query: string, intent?: { domain: string; action: string }, entities?: Record<string, any>): SearchResult[] {
    const scores = new Map<string, { score: number; reasons: string[] }>();

    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = new Set(normalizedQuery.split(/\s+/));

    // 1. Exact tool ID match
    const exactTool = this.registry.toolIndex.get(normalizedQuery);
    if (exactTool) {
      this.addScore(scores, exactTool.definition.id, 1000, 'Exact tool ID match');
    }

    // 2. Alias exact/fuzzy match
    const aliasExact = this.registry.aliasIndex.getToolId(normalizedQuery);
    if (aliasExact) {
      this.addScore(scores, aliasExact, 900, `Alias exact match: "${normalizedQuery}"`);
    }

    const aliasFuzzy = this.registry.aliasIndex.fuzzyMatch(normalizedQuery);
    for (const match of aliasFuzzy) {
      if (match.toolId !== aliasExact) { // Don't double-count
        this.addScore(scores, match.toolId, 600, `Alias fuzzy match: "${match.alias}"`);
      }
    }

    // 3. Domain + action match (if intent is provided)
    if (intent) {
      const domainTools = this.registry.domainIndex.getToolIds(intent.domain);
      for (const toolId of domainTools) {
        this.addScore(scores, toolId, 800, `Domain match: ${intent.domain}`);
      }
    }

    // 4. Tag match
    for (const word of queryWords) {
      const tagTools = this.registry.tagIndex.getToolIds(word);
      for (const toolId of tagTools) {
        this.addScore(scores, toolId, 400, `Tag match: "${word}"`);
      }
    }

    // 5. Entity match
    if (entities) {
      for (const entityType of Object.keys(entities)) {
        const entityTools = this.registry.entityIndex.getToolIds(entityType);
        for (const toolId of entityTools) {
          this.addScore(scores, toolId, 500, `Entity match: ${entityType}`);
        }
      }
    }

    // 6. Knowledge index search (uses its own internal scoring)
    const knowledgeResults = this.registry.knowledgeIndex.search(normalizedQuery);
    for (const kr of knowledgeResults) {
      // Scale knowledge score to max 500
      const scaledScore = Math.min(kr.score * 5, 500);
      this.addScore(scores, kr.toolId, scaledScore, `Knowledge match: "${kr.matchedPhrase}" (score: ${kr.score.toFixed(0)})`);
    }

    // 7. Description fuzzy match
    for (const tool of this.registry.toolIndex.getAll()) {
      const descWords = tool.definition.description.toLowerCase().split(/\s+/);
      const overlap = descWords.filter(w => queryWords.has(w)).length;
      if (overlap > 0) {
        const descScore = Math.min((overlap / descWords.length) * 300, 300);
        this.addScore(scores, tool.definition.id, descScore, `Description word overlap (${overlap} words)`);
      }
    }

    // Build results
    const results: SearchResult[] = [];
    for (const [toolId, data] of scores.entries()) {
      const tool = this.registry.toolIndex.get(toolId);
      if (tool) {
        results.push({ tool, score: data.score, matchReasons: data.reasons });
      }
    }

    // Domain isolation & anti-confusion filters (prevents e.g. "turn the wifi off" from matching "Turn Bluetooth Off")
    for (const res of results) {
      const toolId = res.tool.definition.id.toLowerCase();
      const dispName = res.tool.definition.displayName.toLowerCase();

      if ((normalizedQuery.includes('wifi') || normalizedQuery.includes('wi-fi') || normalizedQuery.includes('wireless')) && !normalizedQuery.includes('bluetooth')) {
        if (toolId.includes('bluetooth') || dispName.includes('bluetooth')) {
          res.score -= 2000;
        }
      }

      if ((normalizedQuery.includes('bluetooth') || normalizedQuery.includes('airpods')) && !normalizedQuery.includes('wifi') && !normalizedQuery.includes('wi-fi')) {
        if (toolId.includes('wifi') || dispName.includes('wifi') || dispName.includes('wireless')) {
          res.score -= 2000;
        }
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Get the best matching tool, or null if no match exceeds the threshold.
   */
  public findBestMatch(query: string, intent?: { domain: string; action: string }, entities?: Record<string, any>, minScore = 200): SearchResult | null {
    const results = this.search(query, intent, entities);
    if (results.length === 0 || results[0].score < minScore) {
      return null;
    }
    return results[0];
  }

  private addScore(scores: Map<string, { score: number; reasons: string[] }>, toolId: string, score: number, reason: string): void {
    const existing = scores.get(toolId);
    if (existing) {
      existing.score += score;
      existing.reasons.push(reason);
    } else {
      scores.set(toolId, { score, reasons: [reason] });
    }
  }
}
