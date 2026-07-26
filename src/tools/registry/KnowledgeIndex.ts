/**
 * KnowledgeIndex.ts
 * 
 * Indexes semantic knowledge from knowledge.json files.
 * Supports retrieval by language variations, common user wording,
 * abbreviations, and common mistakes (typos).
 */

import { LoadedTool } from '../schemas/ToolDefinitionSchema';

export interface KnowledgeEntry {
  toolId: string;
  phrase: string;
  source: 'wording' | 'variation' | 'mistake' | 'abbreviation' | 'synonym';
}

export class KnowledgeIndex {
  private entries: KnowledgeEntry[] = [];
  private abbreviations: Map<string, string> = new Map(); // abbrev → full form

  public add(tool: LoadedTool): void {
    const k = tool.knowledge;
    if (!k) return;

    const id = tool.definition.id;

    for (const w of k.commonUserWording) {
      this.entries.push({ toolId: id, phrase: w.toLowerCase(), source: 'wording' });
    }
    for (const v of k.languageVariations) {
      this.entries.push({ toolId: id, phrase: v.toLowerCase(), source: 'variation' });
    }
    for (const m of k.commonMistakes) {
      this.entries.push({ toolId: id, phrase: m.toLowerCase(), source: 'mistake' });
    }
    for (const s of k.synonyms) {
      this.entries.push({ toolId: id, phrase: s.toLowerCase(), source: 'synonym' });
    }
    for (const [abbrev, full] of Object.entries(k.commonAbbreviations)) {
      this.abbreviations.set(abbrev.toLowerCase(), full.toLowerCase());
      this.entries.push({ toolId: id, phrase: abbrev.toLowerCase(), source: 'abbreviation' });
    }
  }

  /**
   * Score how well a query matches knowledge entries for each tool.
   * Returns tool IDs sorted by relevance score (highest first).
   */
  public search(query: string): Array<{ toolId: string; score: number; matchedPhrase: string }> {
    const normalized = query.toLowerCase();
    const scores = new Map<string, { score: number; matchedPhrase: string }>();

    // Expand abbreviations in query
    let expandedQuery = normalized;
    for (const [abbrev, full] of this.abbreviations.entries()) {
      if (expandedQuery.includes(abbrev)) {
        expandedQuery = expandedQuery.replace(abbrev, full);
      }
    }

    for (const entry of this.entries) {
      let score = 0;

      // Exact match
      if (entry.phrase === normalized || entry.phrase === expandedQuery) {
        score = 100;
      }
      // Query contains the phrase
      else if (normalized.includes(entry.phrase) || expandedQuery.includes(entry.phrase)) {
        score = 70;
      }
      // Phrase contains the query
      else if (entry.phrase.includes(normalized)) {
        score = 50;
      }
      // Word overlap
      else {
        const queryWords = new Set(normalized.split(/\s+/));
        const phraseWords = entry.phrase.split(/\s+/);
        const overlap = phraseWords.filter(w => queryWords.has(w)).length;
        if (overlap > 0) {
          score = (overlap / phraseWords.length) * 40;
        }
      }

      // Boost common user wording matches
      if (entry.source === 'wording') score *= 1.2;
      if (entry.source === 'variation') score *= 1.1;

      if (score > 0) {
        const existing = scores.get(entry.toolId);
        if (!existing || score > existing.score) {
          scores.set(entry.toolId, { score, matchedPhrase: entry.phrase });
        }
      }
    }

    return Array.from(scores.entries())
      .map(([toolId, data]) => ({ toolId, ...data }))
      .sort((a, b) => b.score - a.score);
  }

  public expandAbbreviations(query: string): string {
    let result = query.toLowerCase();
    for (const [abbrev, full] of this.abbreviations.entries()) {
      result = result.replace(new RegExp(`\\b${abbrev}\\b`, 'g'), full);
    }
    return result;
  }

  public clear(): void {
    this.entries = [];
    this.abbreviations.clear();
  }
}
