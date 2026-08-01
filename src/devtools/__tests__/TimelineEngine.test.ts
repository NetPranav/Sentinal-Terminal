import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TraceEngine } from '../tracing/TraceEngine';
import { TimelineEngine } from '../timeline/TimelineEngine';

describe('TimelineEngine — Time-Travel Navigation', () => {
  let traceEngine: TraceEngine;
  let timeline: TimelineEngine;

  beforeEach(() => {
    traceEngine = new TraceEngine();
    timeline = new TimelineEngine(traceEngine);

    traceEngine.record('Planner', 'Started', {});
    traceEngine.record('Runtime', 'Started', {});
    traceEngine.record('Runtime', 'Completed', {});
  });

  it('should initialize with cursor at -1', () => {
    expect(timeline.getCursorIndex()).toBe(-1);
    expect(timeline.getCurrentEvent()).toBeUndefined();
    expect(timeline.getTotalEvents()).toBe(3);
  });

  it('should allow stepping forward and backward', () => {
    timeline.stepForward();
    expect(timeline.getCursorIndex()).toBe(0);
    expect(timeline.getCurrentEvent()?.subsystem).toBe('Planner');

    timeline.stepForward();
    expect(timeline.getCursorIndex()).toBe(1);

    timeline.stepBackward();
    expect(timeline.getCursorIndex()).toBe(0);
  });

  it('should clamp bounds when seeking', () => {
    timeline.seekTo(100);
    expect(timeline.getCursorIndex()).toBe(2);

    timeline.seekTo(-50);
    expect(timeline.getCursorIndex()).toBe(-1);
  });
});
