import { Tool, ToolMetadata } from './types';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, Tool> = new Map();

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public register(tool: Tool): void {
    const meta = tool.metadata;
    if (!meta || !meta.id) {
      console.warn('Attempted to register invalid tool without metadata or ID.');
      return;
    }
    if (this.tools.has(meta.id)) {
      console.warn(`Tool ${meta.id} is already registered. Overwriting.`);
    }
    this.tools.set(meta.id, tool);
  }

  public unregister(id: string): void {
    this.tools.delete(id);
  }

  public get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  public list(): ToolMetadata[] {
    return Array.from(this.tools.values()).map(t => t.metadata);
  }
  
  public search(query: string): ToolMetadata[] {
    const lowerQuery = query.toLowerCase();
    const all = this.list();
    
    return all.filter(t => 
      t.id.toLowerCase().includes(lowerQuery) ||
      t.displayName.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
}
