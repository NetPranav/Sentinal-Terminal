import { ToolIndexer } from './ToolIndexer';

export class ToolSearcher {
  constructor(private indexer: ToolIndexer) {}

  public search(query: string): string[] {
    const tokens = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    const scores = new Map<string, number>();

    const index = this.indexer.getIndex();

    for (const token of tokens) {
      for (const [indexedToken, ids] of index.entries()) {
        if (indexedToken.includes(token) || token.includes(indexedToken)) {
          for (const id of ids) {
            scores.set(id, (scores.get(id) || 0) + 1);
          }
        }
      }
    }

    // Sort by score descending
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
  }
}
