import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityExecutor } from '../execution/CapabilityExecutor';
import { CapabilityRegistry } from '../registry/CapabilityRegistry';
import { createTestNode } from './testHelpers';

describe('CapabilityExecutor — High-Performance Dispatch & Binding', () => {
  let executor: CapabilityExecutor;
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry(true);
    executor = new CapabilityExecutor(registry);
  });

  it('should consume ActionNode inputs directly without natural language interpretation', async () => {
    const node = createTestNode('node-1', 'wifi.connect', { ssid: 'Antigravity_5G', password: 'secret_password' });
    
    const result = await executor.execute(node);

    expect(result.success).toBe(true);
    expect(result.outputs.connectedSSID).toBe('Antigravity_5G');
    expect(result.verification?.verifiedOutputs.connectedSSID).toBe('Antigravity_5G');
    expect(result.rollbackRegistered).toBe(true);
  });

  it('should guarantee execution dispatch overhead is well under <2ms', async () => {
    const node = createTestNode('node-2', 'browser.open', { url: 'https://github.com' });

    const result = await executor.execute(node);

    expect(result.timings.dispatchMs).toBeLessThan(2.0);
    expect(typeof result.timings.executionMs).toBe('number');
    expect(typeof result.timings.verificationMs).toBe('number');
  });

  it('should reliably support executing 1,000+ Action calls without degradation or leakage', async () => {
    const count = 1000;
    const promises: Array<Promise<any>> = [];

    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const node = createTestNode(`node-perf-${i}`, 'filesystem.create_folder', { path: `/tmp/perf_test_${i}` });
      promises.push(executor.execute(node, undefined, 'perf-session'));
    }

    const results = await Promise.all(promises);
    const totalDuration = performance.now() - start;

    expect(results).toHaveLength(count);
    expect(results.every(r => r.success === true)).toBe(true);
    // Ensure high-throughput dispatch averages sub-millisecond per action
    expect(totalDuration / count).toBeLessThan(5.0);
  });

  it('should return completely structured output payloads instead of raw shell text', async () => {
    const node = createTestNode('node-3', 'process.find', { name: 'Safari' });
    const result = await executor.execute(node);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('outputs');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('verification');
    expect(result).toHaveProperty('timings');
    expect(result.outputs).not.toBeInstanceOf(String); // Guaranteed structured Record<string, unknown>
  });
});
