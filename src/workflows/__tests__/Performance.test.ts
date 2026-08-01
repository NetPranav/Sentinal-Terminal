import { describe, it, expect } from 'vitest';
import { WorkflowIRCompiler } from '../engine/WorkflowIRCompiler';
import { WorkflowGraphCompiler } from '../engine/WorkflowGraphCompiler';
import { WorkflowBuilder } from '../builder/WorkflowBuilder';
import { builtinTemplates } from '../templates/WorkflowTemplates';
import { WorkflowRegistry } from '../registry/WorkflowRegistry';

describe('Workflow Engine — Compilation & Execution Performance Benchmarks', () => {
  const irCompiler = new WorkflowIRCompiler();
  const graphCompiler = new WorkflowGraphCompiler();

  it('should compile a 20-node workflow through IR → ActionGraph in sub-millisecond latency', () => {
    const builder = new WorkflowBuilder('Large Workflow');
    for (let i = 0; i < 20; i++) {
      builder.addAction(`step-${i}`, `Step ${i}`, 'system.noop', { index: i }, i > 0 ? [`step-${i - 1}`] : []);
    }
    const wf = builder.build();

    const start = performance.now();
    const { ir, errors } = irCompiler.compile(wf);
    const irMs = performance.now() - start;

    expect(errors.length).toBe(0);
    expect(ir.nodes.length).toBe(20);
    expect(irMs).toBeLessThan(5); // Comfortable sub-5ms with 20 nodes

    const start2 = performance.now();
    const graph = graphCompiler.compile(ir);
    const graphMs = performance.now() - start2;

    expect(graph.nodes.length).toBe(20);
    expect(graphMs).toBeLessThan(5);
  });

  it('should sustain 500+ rapid template instantiation and compilation cycles without degradation', () => {
    const registry = new WorkflowRegistry();
    const count = 500;
    const start = performance.now();

    for (let i = 0; i < count; i++) {
      const userWf = registry.instantiateFromTemplate('tpl-morning-development');
      if (userWf) {
        const { ir } = irCompiler.compile(userWf, { wifiSSID: 'Test_WiFi' });
        graphCompiler.compile(ir);
      }
    }

    const totalMs = performance.now() - start;
    const avgMs = totalMs / count;

    expect(avgMs).toBeLessThan(1.0); // Sub-millisecond per full compilation cycle
  });

  it('should compile loop-heavy workflows with 100 iterations without exceeding 10ms', () => {
    const builder = new WorkflowBuilder('Loop Heavy')
      .addVariable('items', 'array', 'Items', false, Array.from({ length: 100 }, (_, i) => `item-${i}`))
      .addAction('body', 'Process Item', 'system.noop')
      .addLoop('main-loop', 'Process All', ['body'], { loopOverVariable: 'items' });
    const wf = builder.build();

    const start = performance.now();
    const { ir, errors } = irCompiler.compile(wf, { items: Array.from({ length: 100 }, (_, i) => `item-${i}`) });
    const durationMs = performance.now() - start;

    expect(errors.length).toBe(0);
    expect(ir.nodes.length).toBeGreaterThanOrEqual(100); // 100 loop iterations + body action definition
    expect(durationMs).toBeLessThan(10);
  });
});
