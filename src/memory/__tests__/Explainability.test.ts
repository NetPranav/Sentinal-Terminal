import { describe, it, expect } from 'vitest';
import { ExplainabilityEngine } from '../explainability/ExplainabilityEngine';
import { MemoryNode, MemoryEdge } from '../models/MemoryTypes';

function createDummyNode(id: string, type: string, sourceType: any = 'user_explicit'): MemoryNode {
  return {
    id, type, layer: 'long_term', label: 'private', data: {},
    provenance: { source: 't', sourceType, createdBy: 'u', createdAt: 1000, updatedAt: 2000, revision: 1, confidence: 1.0, accessCount: 15 },
    revisionHistory: []
  };
}

describe('ExplainabilityEngine — Memory Retrieval Transparency', () => {
  const engine = new ExplainabilityEngine();

  it('should explain exact matches referencing user provenance and access counts', () => {
    const node = createDummyNode('1', 'Project', 'user_explicit');
    const result = engine.explainDirectMatch(node, 'exact', 1.0);

    expect(result.explanation).toContain('exact project');
    expect(result.explanation).toContain('explicitly saved this');
    expect(result.explanation).toContain('highly accessed memory');
  });

  it('should explain semantic matches referencing automatic observation', () => {
    const node = createDummyNode('2', 'Repository', 'observation_automatic');
    const result = engine.explainDirectMatch(node, 'semantic', 0.85);

    expect(result.explanation).toContain('semantic context');
    expect(result.explanation).toContain('observed this automatically');
  });

  it('should explain relationship traversal paths', () => {
    const sourceNode = createDummyNode('A', 'Project');
    const targetNode = createDummyNode('B', 'Workflow');
    const edge: MemoryEdge = { id: 'e1', sourceId: 'A', targetId: 'B', relationship: 'has_workflow', weight: 0.9, provenance: {} as any };

    const result = engine.explainTraversalMatch(targetNode, [edge], sourceNode);

    expect(result.explanation).toContain('has workflow this workflow');
    expect(result.relevanceScore).toBe(0.9);
    expect(result.relationshipChain).toEqual(['Project', '[has_workflow]', 'Workflow']);
  });

  it('should calculate cumulative confidence across deep relationship chains', () => {
    const sourceNode = createDummyNode('A', 'Project');
    const targetNode = createDummyNode('D', 'Application');
    const e1: MemoryEdge = { id: 'e1', sourceId: 'A', targetId: 'B', relationship: 'contains', weight: 0.9, provenance: {} as any };
    const e2: MemoryEdge = { id: 'e2', sourceId: 'B', targetId: 'C', relationship: 'uses', weight: 0.8, provenance: {} as any };
    const e3: MemoryEdge = { id: 'e3', sourceId: 'C', targetId: 'D', relationship: 'opened_in', weight: 0.5, provenance: {} as any };

    const result = engine.explainTraversalMatch(targetNode, [e1, e2, e3], sourceNode);

    expect(result.relationshipChain).toEqual(['Project', '[contains]', '[uses]', '[opened_in]', 'Application']);
    expect(result.relevanceScore).toBeCloseTo(0.9 * 0.8 * 0.5, 3); // 0.36
  });
});
