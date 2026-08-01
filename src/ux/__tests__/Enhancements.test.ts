import { describe, it, expect } from 'vitest';
import { StartupOptimizer } from '../startup/StartupOptimizer';
import { DocumentationGenerator } from '../documentation/DocumentationGenerator';
import { DemoMode } from '../demo/DemoMode';

describe('UX — Enhancements', () => {
  it('StartupOptimizer should defer heavy tasks immediately', async () => {
    const startup = new StartupOptimizer();
    await startup.fastBoot();
    expect(startup.isBooted()).toBe(true);
  });

  it('DocumentationGenerator should map arrays to markdown', () => {
    const docs = new DocumentationGenerator();
    const md = docs.generateActionReference([{ id: 'test', description: 'desc', permissions: [] }]);
    expect(md).toContain('## test');
    expect(md).toContain('desc');
  });

  it('DemoMode should strictly toggle sandbox guards', () => {
    const demo = new DemoMode();
    expect(demo.isDemoActive()).toBe(false);
    demo.enable();
    expect(demo.isDemoActive()).toBe(true);
  });
});
