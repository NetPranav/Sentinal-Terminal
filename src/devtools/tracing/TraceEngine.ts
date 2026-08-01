/**
 * TraceEngine.ts — Zero-overhead Event Bus for Observability
 */

import { TraceEvent, SubsystemType } from '../models/DevToolsTypes';

export type TraceSubscriber = (event: TraceEvent) => void;

export class TraceEngine {
  private enabled: boolean = true;
  private traces: TraceEvent[] = [];
  private subscribers: Set<TraceSubscriber> = new Set();

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public record(subsystem: SubsystemType, eventName: string, payload: Record<string, unknown>): void {
    if (!this.enabled) return; // Zero-overhead bypass

    const event: TraceEvent = {
      id: `trc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      subsystem,
      eventName,
      payload: Object.freeze(JSON.parse(JSON.stringify(payload))) // Deep clone snapshot
    };

    this.traces.push(event);
    
    // Async dispatch
    this.subscribers.forEach(sub => queueMicrotask(() => sub(event)));
  }

  public getHistory(): ReadonlyArray<TraceEvent> {
    return this.traces;
  }

  public subscribe(subscriber: TraceSubscriber): void {
    this.subscribers.add(subscriber);
  }

  public clear(): void {
    this.traces = [];
  }
}

export const globalTraceEngine = new TraceEngine();
