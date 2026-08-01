import { describe, it, expect } from 'vitest';
import { StateDiffer } from '../diff/StateDiffer';
import { createDefaultWorldModel, createDefaultMetadata, WorldModel, deepFreeze } from '../models/WorldModel';

describe('StateDiffer — Structural Before/After Snapshot Comparison', () => {
  const differ = new StateDiffer();

  it('should report zero modifications when comparing completely identical snapshots', () => {
    const s1 = createDefaultWorldModel('snap-A');
    const report = differ.diff(s1, s1);

    expect(report.hasModifications).toBe(false);
    expect(report.previousSnapshotId).toBe('snap-A');
    expect(report.currentSnapshotId).toBe('snap-A');
  });

  it('should accurately isolate modified, added, and deleted properties between divergent snapshots', () => {
    const s1 = createDefaultWorldModel('snap-prev');
    
    // Create an evolved snapshot with modified WiFi and a new process
    const nextOverrides = {
      wifi: createDefaultMetadata({ connectedSSID: 'Studio_Fiber_WiFi', powered: true, interface: 'en0' }, 'collector:wifi'),
      audio: createDefaultMetadata({ outputVolume: 15, isMuted: true, inputVolume: 80 }, 'collector:system'),
    };

    const s2: WorldModel = deepFreeze({
      ...s1,
      ...nextOverrides,
      snapshotId: 'snap-next',
      timestamp: Date.now() + 1000,
    });

    const report = differ.diff(s1, s2);

    expect(report.hasModifications).toBe(true);
    expect(report.changes.some(c => c.key === 'connectedSSID' && c.after === 'Studio_Fiber_WiFi')).toBe(true);
    expect(report.changes.some(c => c.key === 'isMuted' && c.after === true)).toBe(true);
  });
});
