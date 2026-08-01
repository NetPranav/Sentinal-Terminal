/**
 * PolicyEngine.ts — Enforces Data Lifecycles & Privacy Rules
 *
 * Applies confidence decay over time, enforces TTL expirations,
 * and masks data based on PrivacyLabels.
 */

import { MemoryNode, MemoryObservation, MemoryLayer } from '../models/MemoryTypes';

export class PolicyEngine {
  private readonly DECAY_RATE_PER_DAY = 0.05; // Confidence decays by 5% per day
  private readonly MIN_CONFIDENCE = 0.1;

  /**
   * Evaluates an observation and applies policy defaults before storage.
   */
  public applyWritePolicies(observation: MemoryObservation, existingNode?: MemoryNode): MemoryObservation {
    const payload = { ...observation.payload } as any;

    // Default layer assigning
    if (!payload.layer) {
      payload.layer = 'long_term' as MemoryLayer;
    }

    // Default privacy assigning
    if (!payload.label) {
      payload.label = payload.layer === 'working' || payload.layer === 'session' ? 'temporary' : 'private';
    }

    // Adjust confidence based on source
    if (observation.action === 'upsert' && !existingNode) {
      if (observation.sourceType === 'user_explicit') {
        payload.provenance = { ...payload.provenance, confidence: 1.0 };
      } else if (observation.sourceType === 'observation_automatic') {
        payload.provenance = { ...payload.provenance, confidence: Math.min(observation.confidence, 0.85) };
      } else if (observation.sourceType === 'inferred') {
        payload.provenance = { ...payload.provenance, confidence: Math.min(observation.confidence, 0.6) };
      }
    }

    return {
      ...observation,
      payload,
    };
  }

  /**
   * Applies read-time policies such as data masking and confidence decay.
   */
  public applyReadPolicies(node: MemoryNode, currentTime: number = Date.now()): MemoryNode | null {
    // 1. Enforce Expiration (TTL)
    if (node.label === 'temporary' || node.layer === 'working' || node.layer === 'session') {
      const ageMs = currentTime - node.provenance.updatedAt;
      const ttlMs = 24 * 60 * 60 * 1000; // 24 hours for temporary
      if (ageMs > ttlMs) {
        return null; // Node is expired, hide it from retrieval
      }
    }

    if (node.label === 'deleted') {
      return null;
    }

    // 2. Compute Confidence Decay
    let currentConfidence = node.provenance.confidence;
    
    // Explicit user facts don't decay as aggressively
    if (node.provenance.sourceType !== 'user_explicit' && node.label !== 'pinned') {
      const ageDays = (currentTime - node.provenance.updatedAt) / (1000 * 60 * 60 * 24);
      if (ageDays > 1) {
        currentConfidence = Math.max(
          this.MIN_CONFIDENCE,
          node.provenance.confidence * Math.pow(1 - this.DECAY_RATE_PER_DAY, Math.floor(ageDays))
        );
      }
    }

    // If confidence drops too low, we might filter it out or just return with lowered score
    if (currentConfidence < 0.2 && node.label !== 'pinned') {
      return null;
    }

    // 3. Privacy Masking (In a real system, check execution context roles)
    // For now, we return the node but update its confidence dynamically
    return {
      ...node,
      provenance: {
        ...node.provenance,
        confidence: currentConfidence,
        accessCount: node.provenance.accessCount + 1,
        lastAccessed: currentTime,
      },
    };
  }
}

export const globalPolicyEngine = new PolicyEngine();
