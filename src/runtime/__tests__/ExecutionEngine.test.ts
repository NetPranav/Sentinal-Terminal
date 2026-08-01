import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionEngine } from '../engine/ExecutionEngine';
import { createMockActionNode, createMockActionGraph } from './helpers';

describe('ExecutionEngine — Master Orchestrator', () => {
  let engine: ExecutionEngine;

  beforeEach(() => {
    engine = new ExecutionEngine();
  });

  it('should execute an ActionGraph to completion and produce output snapshot', async () => {
    const nodeA = createMockActionNode('1', 'app.search');
    const nodeB = createMockActionNode('2', 'process.kill', ['1']);
    const graph = createMockActionGraph([nodeA, nodeB]);

    const { sessionId, results, snapshot } = await engine.execute(graph, undefined, 'sess-100');

    expect(sessionId).toBe('sess-100');
    expect(results).toHaveLength(2);
    expect(snapshot.status).toBe('completed');
    expect(snapshot.results).toHaveLength(2);
  });

  it('should remain completely stateless after execution completes', async () => {
    const node = createMockActionNode('1');
    const graph = createMockActionGraph([node]);

    expect(engine.getActiveSessionCount()).toBe(0);

    const { sessionId } = await engine.execute(graph);

    // Verify session state is discarded from engine memory after completion
    expect(engine.getActiveSessionCount()).toBe(0);
    expect(engine.getProgress(sessionId)).toBeUndefined();
    expect(engine.eventBus.getHistory(sessionId)).toHaveLength(0);
  });

  it('should replay a completed session directly from its event history snapshot', async () => {
    const node = createMockActionNode('a1', 'test.replay');
    const graph = createMockActionGraph([node]);

    const { snapshot } = await engine.execute(graph);
    expect(snapshot.events.length).toBeGreaterThan(0);

    const replayedTypes: string[] = [];
    await engine.replaySession(snapshot, (ev) => {
      replayedTypes.push(ev.type);
    });

    expect(replayedTypes).toContain('session_started');
    expect(replayedTypes).toContain('action_completed');
    expect(replayedTypes).toContain('session_completed');
  });

  it('should support hooking into session lifecycle via runtime hooks', async () => {
    const hookFn = vi.fn();
    engine.hooks.register('after_session_finish', hookFn);

    const graph = createMockActionGraph([createMockActionNode('z-1')]);
    await engine.execute(graph);

    expect(hookFn).toHaveBeenCalledTimes(1);
  });
});
