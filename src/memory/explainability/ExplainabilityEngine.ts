/**
 * ExplainabilityEngine.ts — Memory Retrieval Transparency
 *
 * Enriches retrieved memory nodes with natural language reasoning, detailing
 * the path traversal and confidence scores.
 */

import { MemoryNode, MemoryEdge } from '../models/MemoryTypes';

export interface ExplainedMemory {
  readonly node: MemoryNode;
  readonly explanation: string;
  readonly relevanceScore: number;
  readonly relationshipChain?: string[];
}

export class ExplainabilityEngine {
  
  /**
   * Explain a memory retrieved via exact lookup or semantic search.
   */
  public explainDirectMatch(node: MemoryNode, searchMethod: 'exact' | 'semantic', score: number): ExplainedMemory {
    let explanation = '';
    
    if (searchMethod === 'exact') {
      explanation = `I retrieved this exact ${node.type.toLowerCase()} based on your explicit request.`;
    } else {
      explanation = `I found this ${node.type.toLowerCase()} because it closely matches your request's semantic context.`;
    }

    // Augment with provenance context
    if (node.provenance.sourceType === 'user_explicit') {
      explanation += ` You explicitly saved this on ${new Date(node.provenance.createdAt).toLocaleDateString()}.`;
    } else if (node.provenance.sourceType === 'observation_automatic') {
      explanation += ` I observed this automatically while you were working.`;
    }

    if (node.provenance.accessCount > 10) {
      explanation += ` This is a highly accessed memory.`;
    }

    return {
      node,
      explanation,
      relevanceScore: score * node.provenance.confidence,
    };
  }

  /**
   * Explain a memory retrieved via graph traversal (relationship chaining).
   */
  public explainTraversalMatch(node: MemoryNode, pathEdges: MemoryEdge[], sourceNode: MemoryNode): ExplainedMemory {
    if (pathEdges.length === 0) {
      return this.explainDirectMatch(node, 'exact', 1.0);
    }

    const chainStrings: string[] = [];
    let cumulativeWeight = 1.0;

    chainStrings.push(sourceNode.type);
    
    for (const edge of pathEdges) {
      chainStrings.push(`[${edge.relationship}]`);
      cumulativeWeight *= edge.weight;
    }
    
    chainStrings.push(node.type);

    let explanation = `I retrieved this ${node.type.toLowerCase()} because it is connected to the ${sourceNode.type.toLowerCase()} you referenced.`;
    
    if (pathEdges.length === 1) {
      const rel = pathEdges[0].relationship.replace('_', ' ');
      explanation = `I suggested this because the ${sourceNode.type.toLowerCase()} ${rel} this ${node.type.toLowerCase()}.`;
    }

    return {
      node,
      explanation,
      relevanceScore: cumulativeWeight * node.provenance.confidence,
      relationshipChain: chainStrings,
    };
  }
}

export const globalExplainabilityEngine = new ExplainabilityEngine();
