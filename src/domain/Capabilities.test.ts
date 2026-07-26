import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilesystemCapability, FsInput } from './capabilities/FilesystemCapability';
import { SystemCapability } from './capabilities/SystemCapability';

// Mock Tauri Plugins
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn().mockResolvedValue('file content'),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  readDir: vi.fn().mockResolvedValue([{ name: 'test.txt', isDirectory: false }]),
  remove: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  arch: vi.fn().mockResolvedValue('arm64'),
  hostname: vi.fn().mockResolvedValue('test-host'),
  platform: vi.fn().mockResolvedValue('macos'),
  version: vi.fn().mockResolvedValue('14.0'),
  type: vi.fn().mockResolvedValue('Darwin'),
}));

describe('FilesystemCapability', () => {
  let fsCap: FilesystemCapability;

  beforeEach(() => {
    fsCap = new FilesystemCapability();
  });

  it('should read file', async () => {
    const res = await fsCap.execute({ operation: 'read', path: '/test.txt' });
    expect(res.success).toBe(true);
    expect(res.data.content).toBe('file content');
  });

  it('should handle missing write content error locally', async () => {
    const res = await fsCap.execute({ operation: 'write', path: '/test.txt' });
    expect(res.success).toBe(false);
    const errorText = typeof res.error === 'object' && res.error ? res.error.message : res.error;
    expect(errorText).toContain('Content is required');
  });
});

describe('SystemCapability', () => {
  it('should fetch system info', async () => {
    const sysCap = new SystemCapability();
    const res = await sysCap.execute();
    expect(res.success).toBe(true);
    expect(res.data?.architecture).toBe('arm64');
    expect(res.data?.platform).toBe('macos');
  });
});
