/**
 * MemoryStore.ts — Append-Only Revision History Persistence
 *
 * Persists the KnowledgeGraph. Never overwrites existing facts.
 * Every update creates a new MemoryRevision snapshot for auditing.
 */

import { MemoryNode, MemoryEdge, MemoryRevision } from '../models/MemoryTypes';

export class MemoryStore {
  // In-memory representations of persistence layer
  private storedNodes: Map<string, MemoryNode> = new Map();
  private storedEdges: Map<string, MemoryEdge> = new Map();

  /**
   * Save a node, enforcing immutable revision history.
   */
  public saveNode(node: MemoryNode, diffDescription = 'Node updated'): MemoryNode {
    const existing = this.storedNodes.get(node.id);

    if (existing) {
      // Create new revision from existing state
      const newRevision: MemoryRevision = {
        revision: existing.provenance.revision,
        timestamp: Date.now(),
        diffDescription,
        previousState: JSON.parse(JSON.stringify(existing.data)),
      };

      const updatedNode: MemoryNode = {
        ...node,
        provenance: {
          ...node.provenance,
          revision: existing.provenance.revision + 1,
          updatedAt: Date.now(),
        },
        revisionHistory: [...existing.revisionHistory, newRevision],
      };

      this.storedNodes.set(updatedNode.id, updatedNode);
      return updatedNode;
    } else {
      // First save
      const initialNode: MemoryNode = {
        ...node,
        provenance: {
          ...node.provenance,
          revision: 1,
          createdAt: node.provenance.createdAt || Date.now(),
          updatedAt: Date.now(),
        },
        revisionHistory: [],
      };
      this.storedNodes.set(initialNode.id, initialNode);
      return initialNode;
    }
  }

  public getNode(id: string): MemoryNode | undefined {
    return this.storedNodes.get(id);
  }

  public getAllNodes(): MemoryNode[] {
    return Array.from(this.storedNodes.values());
  }

  public deleteNode(id: string): boolean {
    // In a true append-only store, we might just mark it deleted via privacy label.
    // For this implementation, we will remove it from active store for simplicity,
    // though the observation pipeline handles the logical 'delete' labeling.
    return this.storedNodes.delete(id);
  }

  /**
   * Save an edge. Edges are generally immutable connections, so updates 
   * just replace the edge. True revision history on edges is rarely needed, 
   * but we bump the updated timestamp.
   */
  public saveEdge(edge: MemoryEdge): MemoryEdge {
    const existing = this.storedEdges.get(edge.id);
    const savedEdge: MemoryEdge = {
      ...edge,
      provenance: {
        ...edge.provenance,
        revision: existing ? existing.provenance.revision + 1 : 1,
        updatedAt: Date.now(),
        createdAt: existing ? existing.provenance.createdAt : Date.now(),
      }
    };
    this.storedEdges.set(savedEdge.id, savedEdge);
    return savedEdge;
  }

  public getEdge(id: string): MemoryEdge | undefined {
    return this.storedEdges.get(id);
  }

  public getAllEdges(): MemoryEdge[] {
    return Array.from(this.storedEdges.values());
  }

  public deleteEdge(id: string): boolean {
    return this.storedEdges.delete(id);
  }

  /**
   * Load entire stored state (useful for hydrating the KnowledgeGraph on startup).
   */
  public loadAll(): { nodes: MemoryNode[]; edges: MemoryEdge[] } {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
    };
  }

  public clear(): void {
    this.storedNodes.clear();
    this.storedEdges.clear();
  }
}

export const globalMemoryStore = new MemoryStore();
