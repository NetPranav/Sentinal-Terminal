import { describe, it, expect } from 'vitest';
import { TraceEngine } from '../tracing/TraceEngine';
import { DeveloperIndex } from '../index/DeveloperIndex';
import { IDebugProvider } from '../providers/IDebugProvider';

class MockStateProvider implements IDebugProvider {
  subsystemName = 'State' as const;
  getSnapshot() { return { isBluetoothOn: true }; }
  getConfiguration() { return {}; }
  getMetrics() { return []; }
}

describe('DeveloperIndex — Unified Search', () => {
  it('should index both traces and live snapshots in a single query', () => {
    const traceEngine = new TraceEngine();
    const index = new DeveloperIndex(traceEngine);
    index.registerProvider(new MockStateProvider());

    // Record a trace matching "Bluetooth"
    traceEngine.record('Runtime', 'BluetoothConnection', { device: 'Headphones' });
    
    // Add noise trace
    traceEngine.record('Runtime', 'Completed', {});

    const hits = index.search('bluetooth');
    
    expect(hits.length).toBe(2);
    const sources = hits.map(h => h.source);
    expect(sources).toContain('trace');
    expect(sources).toContain('snapshot');
  });
});
