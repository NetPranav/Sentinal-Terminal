/**
 * ConversationMemory.ts — Ring Buffer of Recent Conversation Turns
 *
 * Stores conversation history as a FIFO ring buffer.
 * Configurable max size (default: 20 turns).
 *
 * ONLY remembers:
 * - Recent goals
 * - Recent entities
 * - Recent references
 * - Conversation history
 *
 * Does NOT remember:
 * - Execution results
 * - Shell output
 * - Workflow state
 */

import type {
  ConversationGoal,
  ConversationEntity,
  ConversationMemoryEntry,
  ConversationMemorySnapshot,
} from './ConversationTypes';

/** Default maximum number of turns to store */
const DEFAULT_MAX_SIZE = 20;

export class ConversationMemory {
  private entries: ConversationMemoryEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = Math.max(1, maxSize);
  }

  /**
   * Store a new conversation turn.
   * FIFO eviction when the buffer is full.
   */
  public addTurn(query: string, goal: ConversationGoal, entities: ConversationEntity[]): void {
    const entry: ConversationMemoryEntry = {
      query,
      goal,
      entities: [...entities],
      timestamp: Date.now(),
    };

    this.entries.push(entry);

    // Evict oldest entries if over capacity
    while (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  /**
   * Get the N most recent conversation entries (newest first).
   */
  public getHistory(n?: number): ConversationMemoryEntry[] {
    const count = n ?? this.entries.length;
    return this.entries.slice(-count).reverse();
  }

  /**
   * Get the N most recent goals (newest first).
   */
  public getRecentGoals(n: number = 5): ConversationGoal[] {
    return this.entries
      .slice(-n)
      .reverse()
      .map(e => e.goal);
  }

  /**
   * Get the N most recent entities across all turns (newest first).
   * Deduplicates by type + value.
   */
  public getRecentEntities(n: number = 10): ConversationEntity[] {
    const seen = new Set<string>();
    const result: ConversationEntity[] = [];

    // Walk backwards through entries
    for (let i = this.entries.length - 1; i >= 0 && result.length < n; i--) {
      for (const entity of this.entries[i].entities) {
        const key = `${entity.type}:${entity.value}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(entity);
        }
      }
    }

    return result;
  }

  /**
   * Get the last entry, or null if memory is empty.
   */
  public getLastEntry(): ConversationMemoryEntry | null {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1] : null;
  }

  /**
   * Get the total number of stored turns.
   */
  public size(): number {
    return this.entries.length;
  }

  /**
   * Check if memory is empty.
   */
  public isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * Get the configured maximum size.
   */
  public getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Clear all memory.
   */
  public clear(): void {
    this.entries = [];
  }

  /**
   * Export memory as a serializable JSON snapshot.
   */
  public toSnapshot(): ConversationMemorySnapshot {
    return {
      entries: this.entries.map(e => ({
        query: e.query,
        goal: { ...e.goal },
        entities: e.entities.map(en => ({ ...en })),
        timestamp: e.timestamp,
      })),
      maxSize: this.maxSize,
      exportedAt: Date.now(),
    };
  }

  /**
   * Restore memory from a serialized snapshot.
   */
  public fromSnapshot(snapshot: ConversationMemorySnapshot): void {
    this.maxSize = snapshot.maxSize;
    this.entries = snapshot.entries.slice(-this.maxSize);
  }
}
