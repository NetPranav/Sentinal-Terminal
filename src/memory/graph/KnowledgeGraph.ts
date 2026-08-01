/**
 * KnowledgeGraph.ts — In-Memory Directional Graph
 * Holds nodes and edges, provides traversal and subgraph extraction algorithms.
 * Does NOT handle persistence (that belongs to MemoryStore).
 */

import { MemoryNode, MemoryEdge } from '../models/MemoryTypes';

export class KnowledgeGraph {
  private nodes: Map<string, MemoryNode> = new Map();
  private edges: Map<string, MemoryEdge> = new Map();
  
  // Adjacency lists for fast traversal
  private outgoing: Map<string, Set<string>> = new Map(); // sourceId -> edgeIds
  private incoming: Map<string, Set<string>> = new Map(); // targetId -> edgeIds

  public addNode(node: MemoryNode): void {
    this.nodes.set(node.id, node);
    if (!this.outgoing.has(node.id)) this.outgoing.set(node.id, new Set());
    if (!this.incoming.has(node.id)) this.incoming.set(node.id, new Set());
  }

  public getNode(id: string): MemoryNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): MemoryNode[] {
    return Array.from(this.nodes.values());
  }

  public removeNode(id: string): void {
    // Remove associated edges
    const outEdges = this.outgoing.get(id) || new Set();
    for (const edgeId of outEdges) this.removeEdge(edgeId);

    const inEdges = this.incoming.get(id) || new Set();
    for (const edgeId of inEdges) this.removeEdge(edgeId);

    this.nodes.delete(id);
    this.outgoing.delete(id);
    this.incoming.delete(id);
  }

  public addEdge(edge: MemoryEdge): void {
    if (!this.nodes.has(edge.sourceId) || !this.nodes.has(edge.targetId)) {
      throw new Error(`Cannot add edge ${edge.id}: source or target node missing.`);
    }

    this.edges.set(edge.id, edge);
    this.outgoing.get(edge.sourceId)!.add(edge.id);
    this.incoming.get(edge.targetId)!.add(edge.id);
  }

  public getEdge(id: string): MemoryEdge | undefined {
    return this.edges.get(id);
  }

  public getAllEdges(): MemoryEdge[] {
    return Array.from(this.edges.values());
  }

  public removeEdge(id: string): void {
    const edge = this.edges.get(id);
    if (edge) {
      this.outgoing.get(edge.sourceId)?.delete(id);
      this.incoming.get(edge.targetId)?.delete(id);
      this.edges.delete(id);
    }
  }

  /**
   * Traverse outgoing edges from a starting node.
   */
  public getOutgoingEdges(nodeId: string): MemoryEdge[] {
    const edgeIds = this.outgoing.get(nodeId) || new Set();
    return Array.from(edgeIds).map(id => this.edges.get(id)!).filter(Boolean);
  }

  /**
   * Traverse incoming edges to a target node.
   */
  public getIncomingEdges(nodeId: string): MemoryEdge[] {
    const edgeIds = this.incoming.get(nodeId) || new Set();
    return Array.from(edgeIds).map(id => this.edges.get(id)!).filter(Boolean);
  }

  /**
   * Extract a sub-graph up to a specific depth.
   */
  public extractSubgraph(startNodeId: string, maxDepth = 2): { nodes: MemoryNode[]; edges: MemoryEdge[] } {
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const resultNodes: MemoryNode[] = [];
    const resultEdges: MemoryEdge[] = [];

    const queue: Array<{ id: string; depth: number }> = [{ id: startNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visitedNodes.has(id)) continue;
      visitedNodes.add(id);

      const node = this.getNode(id);
      if (node) resultNodes.push(node);

      if (depth < maxDepth) {
        // Traverse outgoing
        for (const edge of this.getOutgoingEdges(id)) {
          if (!visitedEdges.has(edge.id)) {
            visitedEdges.add(edge.id);
            resultEdges.push(edge);
            queue.push({ id: edge.targetId, depth: depth + 1 });
          }
        }
        // Traverse incoming
        for (const edge of this.getIncomingEdges(id)) {
          if (!visitedEdges.has(edge.id)) {
            visitedEdges.add(edge.id);
            resultEdges.push(edge);
            queue.push({ id: edge.sourceId, depth: depth + 1 });
          }
        }
      }
    }

    return { nodes: resultNodes, edges: resultEdges };
  }

  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.outgoing.clear();
    this.incoming.clear();
  }
}
