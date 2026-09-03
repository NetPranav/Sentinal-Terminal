import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionPersistenceEngine } from './SessionPersistenceEngine';

describe('SessionPersistenceEngine (Issue 5.3)', () => {
  let engine: SessionPersistenceEngine;
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const mockStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, val: string) => { mockStore[key] = val; },
      removeItem: (key: string) => { delete mockStore[key]; }
    };
    vi.stubGlobal('localStorage', mockStorage);
    engine = new SessionPersistenceEngine();
  });

  it('sanitizes stale session IDs from nested split pane trees', () => {
    const splitTree = {
      type: 'split',
      data: {
        id: 'split_1',
        direction: 'vertical',
        pane1: { type: 'terminal', data: { id: 'p1', sessionId: 'stale_session_123' } },
        pane2: {
          type: 'split',
          data: {
            id: 'split_2',
            direction: 'horizontal',
            pane1: { type: 'terminal', data: { id: 'p2', sessionId: 'stale_session_456' } },
            pane2: { type: 'terminal', data: { id: 'p3', sessionId: 'stale_session_789' } }
          }
        }
      }
    };

    const sanitized = engine.sanitizePaneTree(splitTree);
    expect(sanitized.data.pane1.data.sessionId).toBeUndefined();
    expect(sanitized.data.pane1.data.id).toBe('p1');
    expect(sanitized.data.pane2.data.pane1.data.sessionId).toBeUndefined();
    expect(sanitized.data.pane2.data.pane2.data.sessionId).toBeUndefined();
  });

  it('serializes and restores multi-tab and split layouts', async () => {
    const tabs = [
      { id: 't1', name: 'Frontend (Vite)', rootPane: { type: 'terminal', data: { id: 'p1', sessionId: 'sess_1' } } },
      { id: 't2', name: 'Backend (FastAPI)', rootPane: { type: 'terminal', data: { id: 'p2', sessionId: 'sess_2' } } }
    ];
    const panePaths = { p1: '~/workspace/frontend', p2: '~/workspace/backend' };

    // Save synchronously for test
    engine.saveSession(tabs, 't2', panePaths, 0);

    // Wait for timer
    await new Promise(r => setTimeout(r, 10));

    const restored = engine.loadSession();
    expect(restored).not.toBeNull();
    expect(restored?.tabs.length).toBe(2);
    expect(restored?.activeTabId).toBe('t2');
    expect(restored?.tabs[0].name).toBe('Frontend (Vite)');
    expect(restored?.tabs[0].rootPane.data.sessionId).toBeUndefined();
    expect(restored?.panePaths.p1).toBe('~/workspace/frontend');
    expect(restored?.panePaths.p2).toBe('~/workspace/backend');
  });

  it('handles empty or missing storage safely', () => {
    mockStore = {};
    expect(engine.loadSession()).toBeNull();
  });
});
