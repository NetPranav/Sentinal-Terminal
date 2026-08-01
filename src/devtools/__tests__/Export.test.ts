import { describe, it, expect } from 'vitest';
import { TraceEngine } from '../tracing/TraceEngine';
import { TraceExporter } from '../export/TraceExporter';

describe('TraceExporter — Serialization', () => {
  it('should export traces to JSON and Markdown', () => {
    const traceEngine = new TraceEngine();
    const exporter = new TraceExporter(traceEngine);

    traceEngine.record('Planner', 'PlanCreated', { nodes: 2 });
    
    const json = exporter.exportJSON();
    expect(json).toContain('"subsystem": "Planner"');
    expect(json).toContain('"nodes": 2');

    const md = exporter.exportMarkdown();
    expect(md).toContain('# Execution Trace Export');
    expect(md).toContain('Planner :: PlanCreated');
    expect(md).toContain('```json');
  });
});
