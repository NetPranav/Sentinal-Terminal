import { ToolSchemaData } from '../schemas/ToolSchema';

export class ToolIndexer {
  private invertedIndex: Map<string, Set<string>> = new Map();

  public index(tool: ToolSchemaData): void {
    const tokens = this.tokenize(tool.displayName + ' ' + tool.description + ' ' + tool.tags.join(' '));
    for (const token of tokens) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(tool.id);
    }
  }

  public remove(id: string): void {
    for (const [token, ids] of this.invertedIndex.entries()) {
      if (ids.has(id)) {
        ids.delete(id);
        if (ids.size === 0) {
          this.invertedIndex.delete(token);
        }
      }
    }
  }

  public getIndex(): Map<string, Set<string>> {
    return this.invertedIndex;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  }
}
