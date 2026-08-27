import { describe, it, expect } from 'vitest';
import { AgentLoop } from '../AgentLoop';
import { ToolRegistryState } from '../../../tools/loader/ToolLoader';

describe('AgentLoop AI Assistant & Fast Paths', () => {
  const dummyState = {
    toolIndex: { getAll: () => [] }
  } as unknown as ToolRegistryState;

  it('should handle greetings gracefully and instantly without waiting for an LLM', async () => {
    const loop = new AgentLoop(dummyState);
    const result = await loop.run('hello', { os: 'linux', cwd: '~' });
    expect(result.success).toBe(true);
    expect(result.summary).toContain('Sentinel AI');
  });

  it('should handle help queries with full capability guide', async () => {
    const loop = new AgentLoop(dummyState);
    const result = await loop.run('what can you do', { os: 'linux', cwd: '~' });
    expect(result.success).toBe(true);
    expect(result.summary).toContain('System & Diagnostics');
  });

  it('should handle system info prompt via fast-path', async () => {
    const loop = new AgentLoop(dummyState);
    const result = await loop.run('show system specs', { os: 'linux', cwd: '~' });
    expect(result.success).toBe(true);
  });

  it('should handle battery status query via fast-path', async () => {
    const loop = new AgentLoop(dummyState);
    const result = await loop.run('check my battery status', { os: 'linux', cwd: '~' });
    expect(result.success).toBe(true);
  });

  it('should handle file search prompt via fast-path', async () => {
    const loop = new AgentLoop(dummyState);
    const result = await loop.run('find files named package.json', { os: 'linux', cwd: '~' });
    expect(result.success).toBe(true);
  });

  it('should understand direct absolute path as navigation intent', async () => {
    const loop = new AgentLoop(dummyState);
    const result = await loop.run('/home/overxpowered/padhai_in_linux/Projects/sentinal/sentinal-windows', { os: 'linux', cwd: '~' });
    expect(result.success).toBe(true);
    expect(result.cdPath).toBe('/home/overxpowered/padhai_in_linux/Projects/sentinal/sentinal-windows');
  });

  it('should understand relative path and folder name as navigation intent', async () => {
    const loop = new AgentLoop(dummyState);
    const result = await loop.run('sentinal-windows', { os: 'linux', cwd: '/home/overxpowered/padhai_in_linux/Projects/sentinal' });
    expect(result.success).toBe(true);
    expect(result.cdPath).toBe('sentinal-windows');
  });

  it('should understand fullstack project initialization intent with nextjs and django', async () => {
    const loop = new AgentLoop(dummyState);
    const result = await loop.run(
      'Create a folder named portfolio in /home/overxpowered/padhai_in_linux/Projects/ directory and initilize a nextjs frontend and django backend in that folder',
      { os: 'linux', cwd: '~' }
    );
    expect(result.success).toBe(true);
    expect(result.steps[0].tool).toBe('developer.scaffold');
    expect(result.steps[0].params.frontend).toBe('nextjs');
    expect(result.steps[0].params.backend).toBe('django');
    expect(result.steps[0].params.projectName).toBe('portfolio');
    expect(result.steps[0].params.path).toContain('/home/overxpowered/padhai_in_linux/Projects');
  });
});
