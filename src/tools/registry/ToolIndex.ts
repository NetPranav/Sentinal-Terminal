/**
 * ToolIndex.ts
 * 
 * Primary index: maps tool ID → LoadedTool.
 * This is the canonical lookup for any tool by its unique identifier.
 */

import { LoadedTool } from '../schemas/ToolDefinitionSchema';

export class ToolIndex {
  private tools: Map<string, LoadedTool> = new Map();

  public add(tool: LoadedTool): void {
    if (this.tools.has(tool.definition.id)) {
      console.warn(`[ToolIndex] Duplicate tool ID detected: ${tool.definition.id}. Overwriting.`);
    }
    this.tools.set(tool.definition.id, tool);
  }

  public get(id: string): LoadedTool | undefined {
    return this.tools.get(id);
  }

  public has(id: string): boolean {
    return this.tools.has(id);
  }

  public getAll(): LoadedTool[] {
    return Array.from(this.tools.values());
  }

  public getAllIds(): string[] {
    return Array.from(this.tools.keys());
  }

  public count(): number {
    return this.tools.size;
  }

  public remove(id: string): boolean {
    return this.tools.delete(id);
  }

  public clear(): void {
    this.tools.clear();
  }
}
