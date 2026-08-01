/**
 * RetrievalEngine.ts — Multi-Stage Hybrid Memory Retrieval
 *
 * Implements the 8-stage pipeline:
 * Exact Match → Filter → Expand → Semantic → Embedding → Rank → Explain → Context
 */

import { KnowledgeGraph } from '../graph/KnowledgeGraph';
import { PolicyEngine } from '../policies/PolicyEngine';
import { ExplainabilityEngine, ExplainedMemory } from '../explainability/ExplainabilityEngine';
import { MemoryTelemetry } from '../telemetry/MemoryTelemetry';
import { MemoryNode } from '../models/MemoryTypes';

export interface RetrievalQuery {
  readonly id?: string;
  readonly type?: string;
  readonly semanticKeywords?: string[];
  readonly relationToId?: string;
  readonly maxDepth?: number;
  readonly limit?: number;
}

export class RetrievalEngine {
  constructor(
    private graph: KnowledgeGraph,
    private policyEngine: PolicyEngine,
    private explainability: ExplainabilityEngine,
    private telemetry: MemoryTelemetry
  ) {}

  /**
   * Main entry point for the Multi-Stage Retrieval Pipeline.
   */
  public async retrieve(query: RetrievalQuery): Promise<ExplainedMemory[]> {
    const start = performance.now();
    let candidates = new Map<string, ExplainedMemory>();

    // Stage 1: Exact Match
    if (query.id) {
      const node = this.graph.getNode(query.id);
      if (node) {
        const filtered = this.policyEngine.applyReadPolicies(node);
        if (filtered) {
          candidates.set(filtered.id, this.explainability.explainDirectMatch(filtered, 'exact', 1.0));
        }
      }
    }

    // Stage 2: Relationship Expansion (Traverse graph from relationToId)
    if (query.relationToId) {
      const sourceNode = this.graph.getNode(query.relationToId);
      if (sourceNode) {
        const subGraph = this.graph.extractSubgraph(query.relationToId, query.maxDepth || 1);
        
        for (const edge of subGraph.edges) {
          // Identify the 'other' node
          const targetId = edge.sourceId === query.relationToId ? edge.targetId : edge.sourceId;
          if (!candidates.has(targetId)) {
            const rawNode = this.graph.getNode(targetId);
            if (rawNode) {
              const filtered = this.policyEngine.applyReadPolicies(rawNode);
              if (filtered) {
                // Determine direction for explanation
                const pathEdges = [edge]; // Simplified path for depth=1. For deep graphs, extract actual path.
                const explained = this.explainability.explainTraversalMatch(filtered, pathEdges, sourceNode);
                candidates.set(filtered.id, explained);
              }
            }
          }
        }
      }
    }

    // Stage 3: Semantic/Metadata Keyword Filtering
    if (query.semanticKeywords && query.semanticKeywords.length > 0) {
      const allNodes = this.graph.getAllNodes();
      for (const node of allNodes) {
        if (candidates.has(node.id)) continue;
        
        let matchScore = 0;
        const searchableText = JSON.stringify(node.data).toLowerCase();
        
        for (const kw of query.semanticKeywords) {
          if (searchableText.includes(kw.toLowerCase())) {
            matchScore += 0.5;
          }
        }

        if (matchScore > 0) {
          const filtered = this.policyEngine.applyReadPolicies(node);
          if (filtered) {
            candidates.set(filtered.id, this.explainability.explainDirectMatch(filtered, 'semantic', Math.min(matchScore, 1.0)));
          }
        }
      }
    }

    // Stage 4: Type Filtering
    if (query.type) {
      for (const [id, explained] of candidates.entries()) {
        if (explained.node.type !== query.type) {
          candidates.delete(id);
        }
      }
    }

    // Stage 5 & 6: Embedding Search & Rank
    // (Stubbed embedding search in this phase, rely on semantic/exact scores)
    const rankedResults = Array.from(candidates.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, query.limit || 10);

    // Stage 7: Telemetry Update
    this.telemetry.recordRetrieval(rankedResults.length > 0, performance.now() - start);
    
    // Note: Stage 8 (Planner Context Injection) happens upstream where this output is consumed.
    return rankedResults;
  }
}
