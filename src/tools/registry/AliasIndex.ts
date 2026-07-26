/**
 * AliasIndex.ts
 * 
 * Maps alternate wording / aliases → tool IDs.
 * Combines aliases from tool.json and knowledge.json.
 */

import { LoadedTool } from '../schemas/ToolDefinitionSchema';

export class AliasIndex {
  private aliases: Map<string, string> = new Map(); // alias → toolId (1:1)

  public add(tool: LoadedTool): void {
    const id = tool.definition.id;

    // From tool.json aliases
    for (const alias of tool.definition.aliases) {
      this.aliases.set(alias.toLowerCase(), id);
    }

    // From knowledge.json aliases
    if (tool.knowledge?.aliases) {
      for (const alias of tool.knowledge.aliases) {
        this.aliases.set(alias.toLowerCase(), id);
      }
    }

    // From knowledge.json synonyms
    if (tool.knowledge?.synonyms) {
      for (const synonym of tool.knowledge.synonyms) {
        this.aliases.set(synonym.toLowerCase(), id);
      }
    }

    // From knowledge.json commonUserWording
    if (tool.knowledge?.commonUserWording) {
      for (const wording of tool.knowledge.commonUserWording) {
        this.aliases.set(wording.toLowerCase(), id);
      }
    }
  }

  /**
   * Exact match lookup.
   */
  public getToolId(alias: string): string | undefined {
    return this.aliases.get(alias.toLowerCase());
  }

  /**
   * Fuzzy match: returns all aliases that contain the query as a substring.
   */
  public fuzzyMatch(query: string): Array<{ alias: string; toolId: string }> {
    const normalized = query.toLowerCase();
    const results: Array<{ alias: string; toolId: string }> = [];

    for (const [alias, toolId] of this.aliases.entries()) {
      if (alias.includes(normalized) || normalized.includes(alias)) {
        results.push({ alias, toolId });
      }
    }

    return results;
  }

  public getAllAliases(): Map<string, string> {
    return new Map(this.aliases);
  }

  public clear(): void {
    this.aliases.clear();
  }
}
