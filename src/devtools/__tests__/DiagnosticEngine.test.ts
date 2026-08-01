import { describe, it, expect } from 'vitest';
import { TraceEngine } from '../tracing/TraceEngine';
import { DiagnosticEngine } from '../diagnostics/DiagnosticEngine';

describe('DiagnosticEngine — Consolidating Errors', () => {
  it('should generate critical diagnostic reports from error traces', () => {
    const traceEngine = new TraceEngine();
    const diagnostics = new DiagnosticEngine(traceEngine);

    traceEngine.record('Plugin', 'PluginFailed', { reason: 'Crash' });
    traceEngine.record('Runtime', 'NodeQueued', {}); // Should be ignored
    traceEngine.record('Runtime', 'VerificationError', { status: 500 });

    const report = diagnostics.generateReport();
    expect(report.length).toBe(2);
    expect(report[0].severity).toBe('error');
    expect(report[1].subsystem).toBeDefined();
  });
});
