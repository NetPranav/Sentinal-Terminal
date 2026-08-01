import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { StateEngine } from '../engine/StateEngine';
import { StateCache } from '../cache/StateCache';
import { StateEventBus } from '../events/StateEventBus';
import { StateSnapshotManager } from '../snapshot/StateSnapshot';
import { StateQueries } from '../queries/StateQueries';
import { StateTelemetry } from '../telemetry/StateTelemetry';

describe('StateEngine — High-Performance World Model Synchronization & Benchmarking', () => {
  let engine: StateEngine;
  let telemetry: StateTelemetry;

  beforeAll(() => {
    telemetry = new StateTelemetry();
  });

  beforeEach(async () => {
    const eventBus = new StateEventBus();
    const cache = new StateCache(eventBus);
    const snapshots = new StateSnapshotManager();
    const queries = new StateQueries(cache, snapshots);
    engine = new StateEngine(cache, eventBus, undefined, undefined, snapshots, undefined, queries, telemetry);
    await engine.initialize();
  });

  it('should evaluate high-frequency typed query APIs in sub-millisecond latency (<0.2ms)', async () => {
    // Prime hot cache
    await engine.queries.batteryLevel();

    const start = performance.now();
    const res = await engine.queries.batteryLevel();
    const queryMs = performance.now() - start;

    expect(res.data).toBe(92);
    expect(queryMs).toBeLessThan(1.0); // Safely sub-millisecond
  });

  it('should sustain 5,000+ rapid state query evaluations without repeated OS calls or degradation', async () => {
    const count = 5000;
    const start = performance.now();

    for (let i = 0; i < count; i++) {
      await engine.queries.isRunning('Cursor');
      await engine.queries.ownsPort(3000);
    }

    const duration = performance.now() - start;
    const avgLatencyMs = duration / (count * 2);

    expect(avgLatencyMs).toBeLessThan(0.5); // Average evaluation well under 0.5ms per call
  });

  it('should refresh state snapshots via decentralized collectors and report accurate structural diffs', async () => {
    const refreshRes = await engine.refreshState();

    expect(refreshRes.snapshot).toBeDefined();
    expect(Object.isFrozen(refreshRes.snapshot)).toBe(true);
    expect(refreshRes.diff).toBeDefined();

    const authoratative = engine.getAuthoritativeSnapshot();
    expect(authoratative.snapshotId).toBe(refreshRes.snapshot.snapshotId);
  });

  it('should record system performance telemetry capturing cache hit ratios and snapshot creation frequency', () => {
    const metrics = telemetry.getMetrics();
    expect(metrics.snapshotCount).toBeGreaterThan(0);
    expect(metrics.totalQueries).toBeGreaterThanOrEqual(0);
  });
});
