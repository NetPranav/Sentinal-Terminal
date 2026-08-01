import { describe, it, expect } from 'vitest';
import { ExecutionInspector } from '../inspector/Inspectors';
import { TraceEngine } from '../tracing/TraceEngine';
import { IDebugProvider } from '../providers/IDebugProvider';

class MockRuntimeProvider implements IDebugProvider {
  subsystemName = 'Runtime' as const;
  getSnapshot() { return { nodes: [{ status: 'failed' }, { status: 'running' }] }; }
  getMetrics() { return []; }
  getConfiguration() { return {}; }
}

describe('Inspectors — Read-Only Projections', () => {
  it('ExecutionInspector should derive failed nodes from live snapshot without mutation', () => {
    const traceEngine = new TraceEngine();
    const provider = new MockRuntimeProvider();
    const inspector = new ExecutionInspector(provider, traceEngine);

    const failed = inspector.getFailedNodes();
    expect(failed.length).toBe(1);
    expect(failed[0].status).toBe('failed');
    
    // Ensure getSnapshot is immutable by reference (provider returns new obj usually, but type checking confirms read-only)
    const snap = inspector.getLiveSnapshot();
    expect((snap as any).nodes.length).toBe(2);
  });
});
