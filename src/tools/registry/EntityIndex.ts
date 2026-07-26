/**
 * EntityIndex.ts
 * 
 * Maps entity types (ssid, device_name, file_path, etc.) → tool IDs that consume them.
 * Used by the pipeline to narrow down candidate tools based on extracted entities.
 */

import { LoadedTool } from '../schemas/ToolDefinitionSchema';

export class EntityIndex {
  private entities: Map<string, Set<string>> = new Map();

  public add(tool: LoadedTool): void {
    // Index from parameters that declare an entityType
    for (const param of tool.definition.parameters) {
      if (param.entityType) {
        this.addMapping(param.entityType, tool.definition.id);
      }
    }
    for (const param of tool.definition.optionalParameters) {
      if (param.entityType) {
        this.addMapping(param.entityType, tool.definition.id);
      }
    }

    // Index from knowledge entityHints
    if (tool.knowledge?.entityHints) {
      for (const entityType of Object.keys(tool.knowledge.entityHints)) {
        this.addMapping(entityType, tool.definition.id);
      }
    }
  }

  private addMapping(entityType: string, toolId: string): void {
    if (!this.entities.has(entityType)) {
      this.entities.set(entityType, new Set());
    }
    this.entities.get(entityType)!.add(toolId);
  }

  public getToolIds(entityType: string): string[] {
    return Array.from(this.entities.get(entityType) || []);
  }

  public getAllEntityTypes(): string[] {
    return Array.from(this.entities.keys());
  }

  public clear(): void {
    this.entities.clear();
  }
}
