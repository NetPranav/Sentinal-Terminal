import { ToolSchemaData } from '../schemas/ToolSchema';
import { ToolIndexer } from './ToolIndexer';
import { ToolSearcher } from './ToolSearcher';

export class ToolRegistry {
  private tools: Map<string, ToolSchemaData> = new Map();
  private indexer = new ToolIndexer();
  private searcher = new ToolSearcher(this.indexer);

  public register(tool: ToolSchemaData): void {
    this.tools.set(tool.id, tool);
    this.indexer.index(tool);
  }

  public unregister(id: string): void {
    this.tools.delete(id);
    this.indexer.remove(id);
  }

  public get(id: string): ToolSchemaData | undefined {
    return this.tools.get(id);
  }

  public list(): ToolSchemaData[] {
    return Array.from(this.tools.values());
  }

  public search(query: string): ToolSchemaData[] {
    const ids = this.searcher.search(query);
    return ids.map(id => this.tools.get(id)!).filter(Boolean);
  }
}
