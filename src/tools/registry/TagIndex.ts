/**
 * TagIndex.ts
 * 
 * Maps tags → tool IDs. Supports semantic lookup by tag.
 */

import { LoadedTool } from '../schemas/ToolDefinitionSchema';

export class TagIndex {
  private tags: Map<string, Set<string>> = new Map();

  public add(tool: LoadedTool): void {
    for (const tag of tool.definition.tags) {
      const normalized = tag.toLowerCase();
      if (!this.tags.has(normalized)) {
        this.tags.set(normalized, new Set());
      }
      this.tags.get(normalized)!.add(tool.definition.id);
    }
  }

  public getToolIds(tag: string): string[] {
    return Array.from(this.tags.get(tag.toLowerCase()) || []);
  }

  public getAllTags(): string[] {
    return Array.from(this.tags.keys());
  }

  public clear(): void {
    this.tags.clear();
  }
}
