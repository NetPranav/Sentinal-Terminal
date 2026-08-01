/**
 * ObservationPipeline.ts — The Only Path to Memory Mutation
 *
 * Ensures all explicit and implicit facts pass through validation and policy
 * enforcement before being committed to the Store and Graph.
 */

import { MemoryObservation, MemoryNode, MemoryEdge } from '../models/MemoryTypes';
import { MemoryValidator, ValidationResult } from '../validation/MemoryValidator';
import { PolicyEngine } from '../policies/PolicyEngine';
import { MemoryStore } from '../store/MemoryStore';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';

export interface PipelineResult {
  readonly success: boolean;
  readonly errors: string[];
  readonly node?: MemoryNode;
  readonly edge?: MemoryEdge;
}

export class ObservationPipeline {
  constructor(
    private validator: MemoryValidator,
    private policyEngine: PolicyEngine,
    private store: MemoryStore,
    private graph: KnowledgeGraph
  ) {}

  /**
   * Process a single observation through the validation and policy pipeline.
   */
  public process(observation: MemoryObservation): PipelineResult {
    // 1. Validation Phase
    const validation: ValidationResult = this.validator.validateObservation(observation, this.graph);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    if (observation.type === 'node') {
      return this.processNodeObservation(observation);
    } else {
      return this.processEdgeObservation(observation);
    }
  }

  private processNodeObservation(observation: MemoryObservation): PipelineResult {
    const payload = observation.payload as Partial<MemoryNode>;
    const existingNode = payload.id ? this.store.getNode(payload.id) : undefined;

    // 2. Policy Phase
    const enforcedObservation = this.policyEngine.applyWritePolicies(observation, existingNode);
    const enforcedPayload = enforcedObservation.payload as any;

    if (observation.action === 'delete' || observation.action === 'decay') {
      // In append-only store, we update label or confidence rather than true delete
      if (existingNode) {
        const updatedNode = { ...existingNode, label: 'deleted' as const };
        const saved = this.store.saveNode(updatedNode, 'Node marked as deleted');
        this.graph.removeNode(saved.id);
        return { success: true, errors: [], node: saved };
      }
      return { success: false, errors: ['Node not found for deletion'] };
    }

    // 3. Construct Final Node
    const nodeToSave: MemoryNode = {
      id: enforcedPayload.id,
      type: enforcedPayload.type,
      layer: enforcedPayload.layer,
      label: enforcedPayload.label,
      data: enforcedPayload.data,
      provenance: {
        source: enforcedObservation.source,
        sourceType: enforcedObservation.sourceType,
        createdBy: enforcedObservation.createdBy,
        createdAt: existingNode?.provenance.createdAt || Date.now(),
        updatedAt: Date.now(),
        revision: existingNode ? existingNode.provenance.revision + 1 : 1,
        confidence: enforcedPayload.provenance?.confidence ?? enforcedObservation.confidence,
        accessCount: existingNode?.provenance.accessCount || 0,
      },
      revisionHistory: existingNode?.revisionHistory || [],
    };

    // 4. Commit to Store
    const savedNode = this.store.saveNode(nodeToSave, existingNode ? 'Node updated via observation' : 'Initial node creation');

    // 5. Update Graph
    this.graph.addNode(savedNode);

    return { success: true, errors: [], node: savedNode };
  }

  private processEdgeObservation(observation: MemoryObservation): PipelineResult {
    const payload = observation.payload as Partial<MemoryEdge>;
    const existingEdge = payload.id ? this.store.getEdge(payload.id) : undefined;

    if (observation.action === 'delete') {
      if (payload.id) {
        this.store.deleteEdge(payload.id);
        this.graph.removeEdge(payload.id);
        return { success: true, errors: [] };
      }
      return { success: false, errors: ['Edge ID required for deletion'] };
    }

    // Edge creation/update
    const edgeToSave: MemoryEdge = {
      id: payload.id!,
      sourceId: payload.sourceId!,
      targetId: payload.targetId!,
      relationship: payload.relationship!,
      weight: payload.weight ?? 0.8,
      provenance: {
        source: observation.source,
        sourceType: observation.sourceType,
        createdBy: observation.createdBy,
        createdAt: existingEdge?.provenance.createdAt || Date.now(),
        updatedAt: Date.now(),
        revision: existingEdge ? existingEdge.provenance.revision + 1 : 1,
        confidence: observation.confidence,
        accessCount: existingEdge?.provenance.accessCount || 0,
      }
    };

    const savedEdge = this.store.saveEdge(edgeToSave);
    this.graph.addEdge(savedEdge);

    return { success: true, errors: [], edge: savedEdge };
  }
}
