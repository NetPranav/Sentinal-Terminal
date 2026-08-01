import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';
import { MemoryNode, MemoryEdge } from '../models/MemoryTypes';

function createDummyNode(id: string, type: string): MemoryNode {
  return {
    id, type, layer: 'long_term', label: 'private', data: {},
    provenance: { source: 'a', sourceType: 'user_explicit', createdBy: 'u', createdAt: 0, updatedAt: 0, revision: 1, confidence: 1, accessCount: 0 },
    revisionHistory: []
  };
}

function createDummyEdge(id: string, sourceId: string, targetId: string, relationship: string): MemoryEdge {
  return {
    id, sourceId, targetId, relationship, weight: 1.0,
    provenance: { source: 'a', sourceType: 'user_explicit', createdBy: 'u', createdAt: 0, updatedAt: 0, revision: 1, confidence: 1, accessCount: 0 }
  };
}

describe('KnowledgeGraph — In-Memory Directional Traversal & Subgraphs', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    graph = new KnowledgeGraph();
  });

  it('should add nodes and allow retrieval', () => {
    const n1 = createDummyNode('n1', 'Project');
    graph.addNode(n1);
    expect(graph.getNode('n1')).toBeDefined();
    expect(graph.getAllNodes().length).toBe(1);
  });

  it('should add edges between existing nodes and allow bidirectional traversal lookup', () => {
    const n1 = createDummyNode('n1', 'Project');
    const n2 = createDummyNode('n2', 'Repository');
    graph.addNode(n1);
    graph.addNode(n2);

    const edge = createDummyEdge('e1', 'n1', 'n2', 'uses');
    graph.addEdge(edge);

    expect(graph.getEdge('e1')).toBeDefined();
    
    // Check adjacency lists
    const outN1 = graph.getOutgoingEdges('n1');
    expect(outN1.length).toBe(1);
    expect(outN1[0].targetId).toBe('n2');

    const inN2 = graph.getIncomingEdges('n2');
    expect(inN2.length).toBe(1);
    expect(inN2[0].sourceId).toBe('n1');
  });

  it('should refuse to add edges for missing nodes', () => {
    const edge = createDummyEdge('e1', 'missing1', 'missing2', 'uses');
    expect(() => graph.addEdge(edge)).toThrowError(/missing/);
  });

  it('should extract a subgraph up to a specific depth from a starting node', () => {
    graph.addNode(createDummyNode('A', 'Project'));
    graph.addNode(createDummyNode('B', 'Repository'));
    graph.addNode(createDummyNode('C', 'Folder'));
    graph.addNode(createDummyNode('D', 'Application')); // Disconnected or too deep

    graph.addEdge(createDummyEdge('e1', 'A', 'B', 'uses'));
    graph.addEdge(createDummyEdge('e2', 'B', 'C', 'contains'));
    graph.addEdge(createDummyEdge('e3', 'C', 'D', 'opened_in'));

    // Depth 1 from A -> should only include A, B, and edge e1
    const sub1 = graph.extractSubgraph('A', 1);
    expect(sub1.nodes.length).toBe(2);
    expect(sub1.edges.length).toBe(1);

    // Depth 2 from A -> should include A, B, C and edges e1, e2
    const sub2 = graph.extractSubgraph('A', 2);
    expect(sub2.nodes.length).toBe(3);
    expect(sub2.edges.length).toBe(2);
    expect(sub2.nodes.some(n => n.id === 'C')).toBe(true);
    expect(sub2.nodes.some(n => n.id === 'D')).toBe(false);

    // Depth 1 from B -> Should traverse both outgoing (C) and incoming (A)
    const subB = graph.extractSubgraph('B', 1);
    expect(subB.nodes.length).toBe(3); // A, B, C
    expect(subB.edges.length).toBe(2); // e1, e2
  });

  it('should cleanly remove nodes and auto-remove all associated edges', () => {
    graph.addNode(createDummyNode('A', 'Project'));
    graph.addNode(createDummyNode('B', 'Repository'));
    graph.addEdge(createDummyEdge('e1', 'A', 'B', 'uses'));

    expect(graph.getAllEdges().length).toBe(1);
    graph.removeNode('A');
    
    expect(graph.getNode('A')).toBeUndefined();
    expect(graph.getAllEdges().length).toBe(0); // Edge must be removed
    expect(graph.getIncomingEdges('B').length).toBe(0);
  });
});
