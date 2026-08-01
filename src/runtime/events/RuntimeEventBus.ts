/**
 * RuntimeEventBus.ts — Typed, immutable, replayable event bus
 *
 * Every subsystem communicates only through events.
 * Events are immutable and stored for replay/reconstruction.
 */

import { ExecutionEvent, ExecutionEventType } from '../models/RuntimeTypes';
import { randomUUID } from 'crypto';

type EventHandler = (event: ExecutionEvent) => void;

export class RuntimeEventBus {
  private handlers: Map<ExecutionEventType | '*', EventHandler[]> = new Map();
  private history: ExecutionEvent[] = [];

  /**
   * Subscribe to a specific event type, or '*' for all events.
   */
  public on(type: ExecutionEventType | '*', handler: EventHandler): () => void {
    const arr = this.handlers.get(type) || [];
    arr.push(handler);
    this.handlers.set(type, arr);

    // Return unsubscribe function
    return () => {
      const current = this.handlers.get(type) || [];
      this.handlers.set(type, current.filter(h => h !== handler));
    };
  }

  /**
   * Emit an immutable event. Stores in history for replay.
   */
  public emit(
    type: ExecutionEventType,
    sessionId: string,
    data: Record<string, unknown> = {},
    actionNodeId?: string
  ): ExecutionEvent {
    const event: ExecutionEvent = Object.freeze({
      id: randomUUID(),
      type,
      sessionId,
      actionNodeId,
      timestamp: Date.now(),
      data: Object.freeze({ ...data }),
    });

    this.history.push(event);

    // Notify specific handlers
    const specific = this.handlers.get(type) || [];
    for (const handler of specific) {
      try { handler(event); } catch (_) { /* hooks must not crash the bus */ }
    }

    // Notify wildcard handlers
    const wildcard = this.handlers.get('*') || [];
    for (const handler of wildcard) {
      try { handler(event); } catch (_) { /* hooks must not crash the bus */ }
    }

    return event;
  }

  /**
   * Returns the full immutable event history for replay/reconstruction.
   */
  public getHistory(sessionId?: string): ExecutionEvent[] {
    if (sessionId) {
      return this.history.filter(e => e.sessionId === sessionId);
    }
    return [...this.history];
  }

  /**
   * Clears event history (e.g., after session export).
   */
  public clearHistory(sessionId?: string): void {
    if (sessionId) {
      this.history = this.history.filter(e => e.sessionId !== sessionId);
    } else {
      this.history = [];
    }
  }

  /**
   * Removes all handlers and history.
   */
  public reset(): void {
    this.handlers.clear();
    this.history = [];
  }
}
