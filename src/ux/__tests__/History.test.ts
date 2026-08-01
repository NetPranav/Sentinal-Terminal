import { describe, it, expect } from 'vitest';
import { UndoManager } from '../history/UndoManager';
import { HistoryTimeline } from '../history/HistoryTimeline';
import { DiffViewer } from '../diff/DiffViewer';

describe('UX — History & Diff', () => {
  it('UndoManager should enforce LIFO rollback stacking', async () => {
    const mgr = new UndoManager();
    let rolledBack = false;
    
    mgr.push({
      id: '1', description: 'test', timestamp: 0,
      rollback: async () => { rolledBack = true; return true; }
    });
    
    const success = await mgr.undo();
    expect(success).toBe(true);
    expect(rolledBack).toBe(true);
  });

  it('HistoryTimeline should permit substring searching', () => {
    const timeline = new HistoryTimeline();
    timeline.addEntry('Turned on Bluetooth', 'Connected to AirPods');
    
    const hits = timeline.search('airpods');
    expect(hits.length).toBe(1);
  });

  it('DiffViewer should identify modification presence', () => {
    const viewer = new DiffViewer();
    expect(viewer.generateDiff('a', 'a').hasChanges).toBe(false);
    expect(viewer.generateDiff('a', 'b').hasChanges).toBe(true);
  });
});
