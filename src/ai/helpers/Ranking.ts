import { ToolSchemaData } from '../schemas/ToolSchema';
import { Similarity } from './Similarity';

export class Ranking {
  public static rankToolsByRelevance(query: string, tools: ToolSchemaData[]): ToolSchemaData[] {
    const scored = tools.map(tool => {
      // Basic keyword scoring logic
      const descScore = Similarity.similarityScore(query, tool.description);
      const nameScore = Similarity.similarityScore(query, tool.displayName);
      const tagsScore = tool.tags.some(tag => query.toLowerCase().includes(tag.toLowerCase())) ? 0.5 : 0;
      
      const score = Math.max(descScore, nameScore) + tagsScore;
      
      return { tool, score };
    });
    
    return scored
      .filter(s => s.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .map(s => s.tool);
  }
}
