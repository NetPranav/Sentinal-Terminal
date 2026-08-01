import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from '../policies/PolicyEngine';
import { MemoryNode, MemoryObservation } from '../models/MemoryTypes';

describe('PolicyEngine — Data Lifecycles, Expiration, and Confidence Decay', () => {
  let policy: PolicyEngine;

  beforeEach(() => {
    policy = new PolicyEngine();
  });

  it('should apply default policies (layer and label) to new observations based on defaults', () => {
    const obs: MemoryObservation = {
      type: 'node', action: 'upsert', source: 't', sourceType: 'user_explicit', confidence: 0.9, createdBy: 'u',
      payload: { id: '1', type: 'Project', data: {} } // Missing layer and label
    };

    const enforced = policy.applyWritePolicies(obs);
    expect((enforced.payload as any).layer).toBe('long_term');
    expect((enforced.payload as any).label).toBe('private');
  });

  it('should adjust incoming observation confidence based on sourceType (decay defaults)', () => {
    const explicit: MemoryObservation = { type: 'node', action: 'upsert', source: 't', sourceType: 'user_explicit', confidence: 0.5, createdBy: 'u', payload: { id: '1' } };
    const automatic: MemoryObservation = { type: 'node', action: 'upsert', source: 't', sourceType: 'observation_automatic', confidence: 0.95, createdBy: 'u', payload: { id: '2' } };
    const inferred: MemoryObservation = { type: 'node', action: 'upsert', source: 't', sourceType: 'inferred', confidence: 0.9, createdBy: 'u', payload: { id: '3' } };

    expect((policy.applyWritePolicies(explicit).payload as any).provenance.confidence).toBe(1.0); // Explicit boosts to 1.0
    expect((policy.applyWritePolicies(automatic).payload as any).provenance.confidence).toBe(0.85); // Auto capped at 0.85
    expect((policy.applyWritePolicies(inferred).payload as any).provenance.confidence).toBe(0.6); // Inferred capped at 0.6
  });

  it('should expire nodes marked as temporary or working layer if older than TTL', () => {
    const oldTempNode: MemoryNode = {
      id: '1', type: 'Project', layer: 'working', label: 'temporary', data: {},
      provenance: { source: 't', sourceType: 'inferred', createdBy: 'u', createdAt: 0, updatedAt: Date.now() - (48 * 60 * 60 * 1000), revision: 1, confidence: 1, accessCount: 0 },
      revisionHistory: []
    };

    // 48 hours old > 24 hour TTL
    const result = policy.applyReadPolicies(oldTempNode);
    expect(result).toBeNull();
  });

  it('should decay confidence on non-explicit nodes over time', () => {
    const threeDaysOld = Date.now() - (3 * 24 * 60 * 60 * 1000); // exactly 3 days
    
    const node: MemoryNode = {
      id: '1', type: 'Project', layer: 'long_term', label: 'private', data: {},
      provenance: { source: 't', sourceType: 'observation_automatic', createdBy: 'u', createdAt: 0, updatedAt: threeDaysOld, revision: 1, confidence: 0.85, accessCount: 0 },
      revisionHistory: []
    };

    const result = policy.applyReadPolicies(node);
    expect(result).not.toBeNull();
    // Decay: 0.85 * (1 - 0.05)^3 = 0.85 * 0.95^3 = ~0.728
    expect(result!.provenance.confidence).toBeLessThan(0.85);
    expect(result!.provenance.confidence).toBeCloseTo(0.728, 2);
  });

  it('should NOT decay confidence on explicit user nodes', () => {
    const thirtyDaysOld = Date.now() - (30 * 24 * 60 * 60 * 1000); 
    
    const node: MemoryNode = {
      id: '1', type: 'Project', layer: 'long_term', label: 'private', data: {},
      provenance: { source: 't', sourceType: 'user_explicit', createdBy: 'u', createdAt: 0, updatedAt: thirtyDaysOld, revision: 1, confidence: 1.0, accessCount: 0 },
      revisionHistory: []
    };

    const result = policy.applyReadPolicies(node);
    expect(result).not.toBeNull();
    expect(result!.provenance.confidence).toBe(1.0); // No decay applied
  });
});
