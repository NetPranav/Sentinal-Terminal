/**
 * StateEventBus.ts — Real-time event propagation mechanism for State Engine
 *
 * Prefer subscriptions over polling to keep the World Model synchronized.
 * Supports typed system events (ApplicationStarted, WiFiConnected, PortOpened, etc.).
 */

import { StateEventType, StateEvent } from '../models/StateTypes';

type EventCallback<T = any> = (event: StateEvent<T>) => void;

export class StateEventBus {
  private subscribers: Map<string, Set<EventCallback>> = new Map();
  private eventHistory: Array<StateEvent<any>> = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    // Initialize wildcard subscriber set for catch-all listeners
    this.subscribers.set('*', new Set());
  }

  /**
   * Subscribe to specific typed state mutation events or '*' for all events.
   * Returns an un-subscription handler function.
   */
  public subscribe<T = any>(eventType: StateEventType | '*', callback: EventCallback<T>): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    const set = this.subscribers.get(eventType)!;
    set.add(callback as EventCallback);

    return () => {
      set.delete(callback as EventCallback);
    };
  }

  /**
   * Emit a state mutation event to all matching subscribers and wildcard listeners.
   */
  public emit<T = any>(type: StateEventType, payload: T, source = 'state:watcher'): StateEvent<T> {
    const event: StateEvent<T> = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      type,
      timestamp: Date.now(),
      payload,
      source,
    };

    // Store in historical audit buffer
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }

    // Notify specific event listeners
    const handlers = this.subscribers.get(type);
    if (handlers) {
      for (const fn of handlers) {
        try { fn(event); } catch (err) { console.error(`[StateEventBus] Handler error for ${type}:`, err); }
      }
    }

    // Notify wildcard catch-all listeners
    const wildcard = this.subscribers.get('*');
    if (wildcard) {
      for (const fn of wildcard) {
        try { fn(event); } catch (err) { console.error(`[StateEventBus] Wildcard handler error:`, err); }
      }
    }

    return event;
  }

  public getRecentEvents(count = 20, typeFilter?: StateEventType): Array<StateEvent<any>> {
    if (typeFilter) {
      return this.eventHistory.filter(e => e.type === typeFilter).slice(0, count);
    }
    return this.eventHistory.slice(0, count);
  }

  public clearSubscribers(): void {
    this.subscribers.clear();
    this.subscribers.set('*', new Set());
  }

  public clearHistory(): void {
    this.eventHistory = [];
  }
}

export const globalStateEventBus = new StateEventBus();
