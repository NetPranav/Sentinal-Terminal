import { ToolMetadata } from './types';
import { ToolRegistry } from './ToolRegistry';

export class DiscoveryEngine {
  constructor(private registry: ToolRegistry) {}

  /**
   * Filters and ranks tools based on semantic/keyword matching against the user's goal.
   * This ensures the LLM context window isn't bloated with unrelated tools.
   */
  public discoverRelevantTools(goal: string, limit: number = 10): ToolMetadata[] {
    const allTools = this.registry.list();
    const query = goal.toLowerCase();
    const queryWords = query.split(/\s+/);
    
    // Simple heuristic scorer
    const scoredTools = allTools.map(tool => {
      let score = 0;
      
      const idStr = tool.id.toLowerCase();
      const descStr = tool.description.toLowerCase();
      const tagsStr = tool.tags.join(' ').toLowerCase();
      
      for (const word of queryWords) {
        if (word.length < 3) continue; // Skip small stopwords
        
        // Exact match in ID is highly relevant
        if (idStr.includes(word)) score += 10;
        
        // Match in tags
        if (tagsStr.includes(word)) score += 5;
        
        // Match in description
        if (descStr.includes(word)) score += 2;
      }
      
      // If no words matched but the tool is highly foundational (like shell execution),
      // we might give it a base score if we wanted, but for now we trust the LLM prompt.
      // E.g., 'shell.core' is almost always relevant as a fallback.
      if (tool.id === 'shell.core') score += 1;
      
      return { tool, score };
    });
    
    // Sort by score descending
    scoredTools.sort((a, b) => b.score - a.score);
    
    // Filter out tools with absolutely 0 relevance unless they are foundational
    const relevant = scoredTools.filter(t => t.score > 0).slice(0, limit);
    
    return relevant.map(t => t.tool);
  }
}
