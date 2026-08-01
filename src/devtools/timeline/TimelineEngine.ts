/**
 * TimelineEngine.ts — Time-Travel playback and seeking for TraceEvents
 */

import { TraceEngine } from '../tracing/TraceEngine';
import { TraceEvent } from '../models/DevToolsTypes';

export class TimelineEngine {
  private cursor: number = -1; // Index in the trace history
  private playing: boolean = false;
  
  constructor(private traceEngine: TraceEngine) {}

  public getCursorIndex(): number {
    return this.cursor;
  }

  public getTotalEvents(): number {
    return this.traceEngine.getHistory().length;
  }

  public getCurrentEvent(): TraceEvent | undefined {
    const history = this.traceEngine.getHistory();
    if (this.cursor >= 0 && this.cursor < history.length) {
      return history[this.cursor];
    }
    return undefined;
  }

  public seekTo(index: number): void {
    const total = this.getTotalEvents();
    if (index < -1) index = -1;
    if (index >= total) index = total - 1;
    this.cursor = index;
  }

  public stepForward(): void {
    this.seekTo(this.cursor + 1);
  }

  public stepBackward(): void {
    this.seekTo(this.cursor - 1);
  }

  public play(speedMs: number = 100, onUpdate?: (evt: TraceEvent) => void): void {
    if (this.playing) return;
    this.playing = true;

    const interval = setInterval(() => {
      if (!this.playing || this.cursor >= this.getTotalEvents() - 1) {
        clearInterval(interval);
        this.playing = false;
        return;
      }
      this.stepForward();
      if (onUpdate && this.getCurrentEvent()) {
        onUpdate(this.getCurrentEvent()!);
      }
    }, speedMs);
  }

  public pause(): void {
    this.playing = false;
  }
}
