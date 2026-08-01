import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryValidator } from '../validation/MemoryValidator';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';
import { MemoryObservation, MemoryNode } from '../models/MemoryTypes';

describe('MemoryValidator — Schema Enforcement & Graph Integrity', () => {
  let validator: MemoryValidator;
  let graph: KnowledgeGraph;

  beforeEach(() => {
    validator = new MemoryValidator();
    graph = new KnowledgeGraph();
  });

  it('should validate complete node observations matching Zod schemas', () => {
    const obs: MemoryObservation = {
      type: 'node', action: 'upsert', source: 't', sourceType: 'user_explicit', confidence: 1.0, createdBy: 'u',
      payload: {
        id: '1', type: 'Project',
        data: { name: 'Apollo', status: 'active' }
      }
    };

    const result = validator.validateObservation(obs, graph);
    expect(result.valid).toBe(true);
  });

  it('should reject node observations failing Zod schema constraints', () => {
    const obs: MemoryObservation = {
      type: 'node', action: 'upsert', source: 't', sourceType: 'user_explicit', confidence: 1.0, createdBy: 'u',
      payload: {
        id: '1', type: 'Port',
        data: { number: 99999 } // Invalid port number
      }
    };

    const result = validator.validateObservation(obs, graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Schema validation failed'))).toBe(true);
  });

  it('should reject edge observations with unknown relationship types', () => {
    const obs: MemoryObservation = {
      type: 'edge', action: 'upsert', source: 't', sourceType: 'user_explicit', confidence: 1.0, createdBy: 'u',
      payload: {
        id: 'e1', sourceId: 'n1', targetId: 'n2', relationship: 'unknown_type'
      }
    };

    const result = validator.validateObservation(obs, graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Unknown relationship type'))).toBe(true);
  });

  it('should detect and prevent circular ownership dependencies (e.g. A owns B, B owns A)', () => {
    const n1: MemoryNode = {
      id: 'A', type: 'Folder', layer: 'long_term', label: 'private', data: {},
      provenance: { source: 't', sourceType: 'inferred', createdBy: 'u', createdAt: 0, updatedAt: 0, revision: 1, confidence: 1, accessCount: 0 },
      revisionHistory: []
    };
    const n2: MemoryNode = { ...n1, id: 'B' };
    graph.addNode(n1);
    graph.addNode(n2);
    graph.addEdge({ id: 'e1', sourceId: 'A', targetId: 'B', relationship: 'contains', weight: 1.0, provenance: {} as any });

    const obs: MemoryObservation = {
      type: 'edge', action: 'upsert', source: 't', sourceType: 'user_explicit', confidence: 1.0, createdBy: 'u',
      payload: {
        id: 'e2', sourceId: 'B', targetId: 'A', relationship: 'contains' // This creates A contains B contains A
      }
    };

    const result = validator.validateObservation(obs, graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('circular contains dependency'))).toBe(true);
  });
});
