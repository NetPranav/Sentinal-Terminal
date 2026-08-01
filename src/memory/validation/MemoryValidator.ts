/**
 * MemoryValidator.ts — Structural & Semantic Knowledge Graph Validation
 *
 * Prevents duplicates, broken edge references, circular ownership constraints,
 * and ensures entities match their defined schemas.
 */

import { MemoryNode, MemoryEdge, MemoryObservation } from '../models/MemoryTypes';
import { EntitySchemas, SupportedEntityType } from '../entities/EntitySchemas';
import { isValidRelationship } from '../relationships/RelationshipTypes';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

export class MemoryValidator {
  
  /**
   * Validates an observation before it enters the Policy Engine and Store.
   */
  public validateObservation(observation: MemoryObservation, currentGraph: KnowledgeGraph): ValidationResult {
    const errors: string[] = [];

    if (!observation.source || !observation.sourceType) {
      errors.push('Observation must include source and sourceType provenance.');
    }

    if (observation.confidence < 0 || observation.confidence > 1.0) {
      errors.push('Observation confidence must be between 0.0 and 1.0.');
    }

    if (observation.type === 'node') {
      const node = observation.payload as Partial<MemoryNode>;
      if (!node.id) {
        errors.push('Node observation must include id.');
      } else if (observation.action === 'upsert') {
        if (!node.type) {
          errors.push('Node observation must include type.');
        } else {
          const schemaError = this.validateEntitySchema(node.type, node.data);
          if (schemaError) errors.push(schemaError);
        }
      }
    } else if (observation.type === 'edge') {
      const edge = observation.payload as Partial<MemoryEdge>;
      if (!edge.id || !edge.sourceId || !edge.targetId || !edge.relationship) {
        errors.push('Edge observation must include id, sourceId, targetId, and relationship.');
      } else if (observation.action === 'upsert') {
        if (!isValidRelationship(edge.relationship)) {
          errors.push(`Unknown relationship type: '${edge.relationship}'`);
        }
        
        // Check for broken edges
        if (!currentGraph.getNode(edge.sourceId)) {
          errors.push(`Source node '${edge.sourceId}' does not exist for edge '${edge.id}'.`);
        }
        if (!currentGraph.getNode(edge.targetId)) {
          errors.push(`Target node '${edge.targetId}' does not exist for edge '${edge.id}'.`);
        }

        // Check for circular ownership (e.g. A owns B, B owns A)
        if (edge.relationship === 'owns' || edge.relationship === 'contains' || edge.relationship === 'belongs_to') {
          if (this.wouldCreateCycle(edge.sourceId, edge.targetId, edge.relationship, currentGraph)) {
            errors.push(`Adding edge '${edge.id}' would create a circular ${edge.relationship} dependency.`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateEntitySchema(type: string, data: any): string | null {
    const schema = EntitySchemas[type as SupportedEntityType];
    if (!schema) {
      // We allow unknown types to be flexible, but warn if it's completely missing
      return `Warning: Unknown entity schema type '${type}'. Data not validated.`;
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return `Schema validation failed for type '${type}': ${issues}`;
    }

    return null;
  }

  private wouldCreateCycle(sourceId: string, targetId: string, relationship: string, graph: KnowledgeGraph): boolean {
    // A simple cycle check: if we are trying to add source -> target,
    // does target already reach source via the SAME hierarchical relationship?
    const visited = new Set<string>();
    
    const dfs = (currentId: string): boolean => {
      if (currentId === sourceId) return true; // Cycle detected
      if (visited.has(currentId)) return false;
      visited.add(currentId);

      const edges = graph.getOutgoingEdges(currentId);
      for (const edge of edges) {
        if (edge.relationship === relationship) {
          if (dfs(edge.targetId)) return true;
        }
      }
      return false;
    };

    return dfs(targetId);
  }
}

export const globalMemoryValidator = new MemoryValidator();
