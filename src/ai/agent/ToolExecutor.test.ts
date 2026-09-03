import { describe, expect, it, vi } from 'vitest';
import { ToolExecutor } from './ToolExecutor';

describe('ToolExecutor security integration', () => {
  it('accepts a complete macOS shell command line as one command parameter', async () => {
    const executor = new ToolExecutor();

    const result = await executor.execute('shell.execute', { command: 'git status --short' }, '.');

    expect(result.success).toBe(true);
    expect(result.data?.stdout).toContain('git status --short');
  });

  it('requires explicit approval before a process-termination action', async () => {
    const requestApproval = vi.fn().mockResolvedValue(false);
    const executor = new ToolExecutor();

    const result = await executor.execute(
      'system.kill_process',
      { process: 'node' },
      '.',
      requestApproval
    );

    expect(requestApproval).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(result.error).toContain('User denied execution');
  });

  it('enforces execution timeout and cancels active driver when a command exceeds timeoutMs', async () => {
    const executor = new ToolExecutor();
    const mockSlowDriver = {
      capabilityId: 'test.slow_hang',
      name: 'Hanging Test Driver',
      supportedPlatforms: ['macos', 'windows', 'linux'],
      execute: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500))),
      verify: vi.fn().mockResolvedValue(true),
      rollback: vi.fn().mockResolvedValue(true),
      cancel: vi.fn().mockResolvedValue(true)
    };

    (executor['sdk'] as any).register('test.slow_hang', mockSlowDriver);

    const result = await executor.execute(
      'test.slow_hang',
      {},
      '.',
      undefined,
      50 // 50ms timeout
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out after 50ms');
    expect(mockSlowDriver.cancel).toHaveBeenCalled();
  });
});
