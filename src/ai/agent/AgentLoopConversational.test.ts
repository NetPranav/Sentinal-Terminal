import { describe, it, expect, beforeEach } from 'vitest';
import { AgentLoop } from './AgentLoop';

describe('AgentLoop Conversational & Offline Resilience', () => {
  let agentLoop: AgentLoop;

  beforeEach(() => {
    const mockRegistry = {
      toolIndex: { getAll: () => [] }
    };
    const mockToolExecutor = {
      hasDriver: () => true,
      execute: (tool: string, params: any) => Promise.resolve({ success: true, data: {} })
    };
    agentLoop = new AgentLoop(mockRegistry as any, mockToolExecutor as any);
  });

  it('answers "hey" and conversational greetings immediately without needing an LLM', async () => {
    const res = await agentLoop.run('hey', { os: 'darwin', cwd: '/tmp' });
    expect(res.success).toBe(true);
    expect(res.summary).toContain('Sentinel AI');
    expect(res.summary).toContain('copilot');
    expect(res.steps.length).toBe(0);
  });

  it('answers "who are you" and "help" with a list of terminal capabilities', async () => {
    const res = await agentLoop.run('who are you', { os: 'darwin', cwd: '/tmp' });
    expect(res.success).toBe(true);
    expect(res.summary).toContain('autonomous terminal agent');
    expect(res.summary).toContain('port 3000');
  });

  it('initiates model setup with ">setup-ai"', async () => {
    const res = await agentLoop.run('setup-ai', { os: 'darwin', cwd: '/tmp' });
    expect(res.success).toBe(true);
    expect(res.summary).toContain('Qwen 2.5 Coder 3B');
  });
});
