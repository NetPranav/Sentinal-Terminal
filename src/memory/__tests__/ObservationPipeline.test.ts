import { describe, it, expect, beforeEach } from 'vitest';
import { ObservationPipeline } from '../pipeline/ObservationPipeline';
import { MemoryValidator } from '../validation/MemoryValidator';
import { PolicyEngine } from '../policies/PolicyEngine';
import { MemoryStore } from '../store/MemoryStore';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';
import { MemoryObservation } from '../models/MemoryTypes';

describe('ObservationPipeline — Safe Memory Mutations', () => {
  let pipeline: ObservationPipeline;
  let store: MemoryStore;
  let graph: KnowledgeGraph;

  beforeEach(() => {
    const validator = new MemoryValidator();
    const policy = new PolicyEngine();
    store = new MemoryStore();
    graph = new KnowledgeGraph();
    pipeline = new ObservationPipeline(validator, policy, store, graph);
  });

  it('should process a valid node observation, apply policies, store it, and add to graph', () => {
    const obs: MemoryObservation = {
      type: 'node',
      action: 'upsert',
      source: 'test',
      sourceType: 'user_explicit',
      confidence: 1.0,
      createdBy: 'pranav',
      payload: {
        id: 'proj-1',
        type: 'Project',
        data: { name: 'Apollo' },
      }
    };

    const result = pipeline.process(obs);
    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.node).toBeDefined();
    
    // Check policy defaults
    expect(result.node!.layer).toBe('long_term');
    expect(result.node!.label).toBe('private');
    
    // Verify it exists in store and graph
    expect(store.getNode('proj-1')).toBeDefined();
    expect(graph.getNode('proj-1')).toBeDefined();
  });

  it('should reject invalid node observations (missing ID or Type)', () => {
    const obs: MemoryObservation = {
      type: 'node', action: 'upsert', source: 'test', sourceType: 'user_explicit', confidence: 1.0, createdBy: 'pranav',
      payload: { data: { name: 'Apollo' } } // Missing ID and Type
    };

    const result = pipeline.process(obs);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject edge observations with broken references', () => {
    const obs: MemoryObservation = {
      type: 'edge', action: 'upsert', source: 'test', sourceType: 'user_explicit', confidence: 1.0, createdBy: 'pranav',
      payload: {
        id: 'e1',
        sourceId: 'missing-node-1',
        targetId: 'missing-node-2',
        relationship: 'uses',
      }
    };

    const result = pipeline.process(obs);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('does not exist'))).toBe(true);
  });

  it('should successfully add a valid edge when nodes exist', () => {
    // Add nodes first
    pipeline.process({ type: 'node', action: 'upsert', source: 't', sourceType: 'inferred', confidence: 1, createdBy: 'u', payload: { id: 'n1', type: 'Project', data: { name: 'A' } } });
    pipeline.process({ type: 'node', action: 'upsert', source: 't', sourceType: 'inferred', confidence: 1, createdBy: 'u', payload: { id: 'n2', type: 'Repository', data: { url: 'B' } } });

    const edgeObs: MemoryObservation = {
      type: 'edge', action: 'upsert', source: 'test', sourceType: 'inferred', confidence: 0.8, createdBy: 'pranav',
      payload: { id: 'e1', sourceId: 'n1', targetId: 'n2', relationship: 'uses' }
    };

    const result = pipeline.process(edgeObs);
    expect(result.success).toBe(true);
    expect(store.getEdge('e1')).toBeDefined();
    expect(graph.getEdge('e1')).toBeDefined();
  });

  it('should handle node deletion logically by marking it deleted and removing from graph', () => {
    pipeline.process({ type: 'node', action: 'upsert', source: 't', sourceType: 'user_explicit', confidence: 1, createdBy: 'u', payload: { id: 'n1', type: 'Project', data: { name: 'A' } } });

    const result = pipeline.process({
      type: 'node', action: 'delete', source: 't', sourceType: 'user_explicit', confidence: 1, createdBy: 'u',
      payload: { id: 'n1' }
    });

    expect(result.success).toBe(true);
    
    // Store should retain it as 'deleted'
    const stored = store.getNode('n1');
    expect(stored?.label).toBe('deleted');

    // Graph should not have it
    expect(graph.getNode('n1')).toBeUndefined();
  });
});
