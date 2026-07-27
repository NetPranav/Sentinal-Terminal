/**
 * ToolSearcher.ts
 * 
 * Multi-dimensional semantic search across all registry indexes with stopword exclusion,
 * typo tolerance, and strict domain isolation guardrails.
 * 
 * Search dimensions (in priority order):
 * 1. Tool ID exact match (score: 1000)
 * 2. Alias exact match (score: 900)
 * 3. Domain + action match (score: 800)
 * 4. Typo-tolerant Tool ID & Name semantic word match (score: variable, 400/term)
 * 5. Tag match (score: 400)
 * 6. Knowledge index scored match (score: variable, up to 500)
 * 7. Description fuzzy match (score: up to 300)
 */

import { ToolRegistryState } from '../loader/ToolLoader';
import { LoadedTool } from '../schemas/ToolDefinitionSchema';

export interface SearchResult {
  tool: LoadedTool;
  score: number;
  matchReasons: string[];
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

function isWordMatch(queryWord: string, targetWord: string): boolean {
  if (!queryWord || !targetWord) return false;
  if (queryWord === targetWord) return true;
  if (queryWord.length < 3 || targetWord.length < 3) return false;
  if (queryWord.length >= 5 && targetWord.length >= 5 && queryWord.substring(0, 4) === targetWord.substring(0, 4)) return true;
  const dist = levenshtein(queryWord, targetWord);
  if (queryWord.length >= 7 && dist <= 2) return true;
  if (queryWord.length >= 4 && dist <= 1) return true;
  return false;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'by', 'for', 'with',
  'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from',
  'up', 'down', 'out', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'me', 'my',
  'i', 'you', 'your', 'we', 'our', 'he', 'she', 'it', 'they', 'them', 'show', 'list', 'tell', 'give', 'make', 'do',
  'please', 'could', 'would', 'kindly', 'want', 'need', 'help', 'did', 'does', 'have', 'has', 'had', 'been', 'what'
]);

export class ToolSearcher {
  constructor(private registry: ToolRegistryState) {}

  /**
   * Search for tools matching a natural language query.
   * Returns results sorted by score (highest first).
   */
  public search(query: string, intent?: { domain: string; action: string }, entities?: Record<string, any>): SearchResult[] {
    const scores = new Map<string, { score: number; reasons: string[] }>();

    const normalizedQuery = query.toLowerCase().trim();
    const rawWords = normalizedQuery.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(Boolean);
    const queryWords = new Set(rawWords.filter(w => !STOPWORDS.has(w) && w.length > 1));

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
      if (match.toolId !== aliasExact) {
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

    // 4. Tag match (excluding stopwords)
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

    // 6. Knowledge index search
    const knowledgeResults = this.registry.knowledgeIndex.search(normalizedQuery);
    for (const kr of knowledgeResults) {
      const scaledScore = Math.min(kr.score * 5, 500);
      this.addScore(scores, kr.toolId, scaledScore, `Knowledge match: "${kr.matchedPhrase}" (score: ${kr.score.toFixed(0)})`);
    }

    // 7. Typo-tolerant semantic keyword match on Tool IDs and Display Names
    for (const tool of this.registry.toolIndex.getAll()) {
      const idWords = tool.definition.id.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
      const nameWords = tool.definition.displayName.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
      const targetWords = [...new Set([...idWords, ...nameWords])];

      let matchCount = 0;
      for (const qw of queryWords) {
        if (targetWords.some(tw => isWordMatch(qw, tw))) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        this.addScore(scores, tool.definition.id, matchCount * 400, `Semantic keyword/typo match (${matchCount} terms)`);
      }

      // Description fuzzy match (using content words without stopwords)
      const descWords = tool.definition.description.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => !STOPWORDS.has(w) && w.length > 1);
      const overlap = descWords.filter(w => [...queryWords].some(qw => isWordMatch(qw, w))).length;
      if (overlap > 0) {
        const descScore = Math.min((overlap / (descWords.length || 1)) * 300, 300);
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

    // Strict Domain Isolation & Anti-Confusion Filters
    const hasBluetooth = /bluetooth|bt|airpod|headphone|earbud|speaker|mouse|keyboard|pair/i.test(normalizedQuery);
    const hasWifi = /wifi|wi-fi|wireless|wlan|internet|ssid|router|network|hotspot/i.test(normalizedQuery);
    const hasAppOrProcess = /app|applic|program|process|runn|kill|terminate/i.test(normalizedQuery);
    const hasBattery = /battery|power|charge|charging|energy/i.test(normalizedQuery);

    for (const res of results) {
      const toolId = res.tool.definition.id.toLowerCase();
      const dispName = res.tool.definition.displayName.toLowerCase();

      // Never match Bluetooth tools if no Bluetooth keywords were mentioned
      if ((toolId.includes('bluetooth') || dispName.includes('bluetooth')) && !hasBluetooth) {
        res.score -= 3000;
      }

      // Never match Wi-Fi tools if no Wi-Fi keywords were mentioned (unless paired with bluetooth)
      if ((toolId.includes('wifi') || dispName.includes('wifi') || dispName.includes('wireless')) && !hasWifi) {
        res.score -= 3000;
      }

      // Prevent networking/wireless tools from overriding app/process listings
      if (hasAppOrProcess && !hasBluetooth && !hasWifi) {
        if (toolId.includes('network.') || toolId.includes('wifi') || toolId.includes('bluetooth')) {
          res.score -= 3000;
        }
      }

      // Never match Battery tools if no battery keywords were mentioned
      if (toolId.includes('battery') && !hasBattery) {
        res.score -= 3000;
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

