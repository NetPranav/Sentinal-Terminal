import { describe, it, expect } from 'vitest';
import { TraceEngine } from '../tracing/TraceEngine';
import { GraphVisualizer } from '../visualizer/GraphVisualizer';

describe('GraphVisualizer — DAG Derivations', () => {
  it('should generate a structural DAG representation from Runtime traces', () => {
    const traceEngine = new TraceEngine();
    const vis = new GraphVisualizer(traceEngine);

    traceEngine.record('Runtime', 'Node1Started', {});
    traceEngine.record('Runtime', 'Node2Started', {});
    traceEngine.record('Planner', 'Ignored', {}); // Should be excluded from Runtime DAG
    traceEngine.record('Runtime', 'Node3Started', {});

    const graph = vis.generateExecutionDAG();
    expect(graph.nodes.length).toBe(3);
    expect(graph.edges.length).toBe(2);
    
    // Check sequential linkage
    expect(graph.edges[0].source).toBe(graph.nodes[0].id);
    expect(graph.edges[0].target).toBe(graph.nodes[1].id);
  });
});
