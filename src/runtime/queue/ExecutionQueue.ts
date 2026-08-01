/**
 * ExecutionQueue.ts — Priority queue with dependency gating
 *
 * Nodes only become eligible when all dependencies are satisfied.
 * O(log n) insert, O(n) eligible scan (acceptable for typical graph sizes).
 */

import { ActionNode } from '../../actions/models/ActionTypes';
import { NodeState } from '../models/RuntimeTypes';

interface QueueEntry {
  node: ActionNode;
  priority: number; // Lower = higher priority
  enqueuedAt: number;
}

export class ExecutionQueue {
  private entries: QueueEntry[] = [];

  /**
   * Enqueue a node with optional priority (default 0).
   */
  public enqueue(node: ActionNode, priority: number = 0): void {
    const entry: QueueEntry = { node, priority, enqueuedAt: Date.now() };

    // Insert in sorted position (ascending priority = highest first)
    let inserted = false;
    for (let i = 0; i < this.entries.length; i++) {
      if (priority < this.entries[i].priority) {
        this.entries.splice(i, 0, entry);
        inserted = true;
        break;
      }
    }
    if (!inserted) this.entries.push(entry);
  }

  /**
   * Dequeues the next eligible node whose dependencies are all satisfied.
   * Uses nodeStates to check dependency completion.
   */
  public dequeueEligible(nodeStates: Record<string, NodeState>): ActionNode | null {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const allDepsSatisfied = entry.node.dependencies.every(
        depId => nodeStates[depId] === 'completed'
      );

      if (allDepsSatisfied) {
        this.entries.splice(i, 1);
        return entry.node;
      }
    }
    return null;
  }

  /**
   * Returns all currently eligible nodes without removing them.
   */
  public peekEligible(nodeStates: Record<string, NodeState>): ActionNode[] {
    return this.entries
      .filter(entry =>
        entry.node.dependencies.every(depId => nodeStates[depId] === 'completed')
      )
      .map(entry => entry.node);
  }

  /**
   * Removes a specific node from the queue (for cancellation).
   */
  public remove(nodeId: string): boolean {
    const idx = this.entries.findIndex(e => e.node.id === nodeId);
    if (idx >= 0) {
      this.entries.splice(idx, 1);
      return true;
    }
    return false;
  }

  public size(): number {
    return this.entries.length;
  }

  public isEmpty(): boolean {
    return this.entries.length === 0;
  }

  public clear(): void {
    this.entries = [];
  }
}
