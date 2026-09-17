import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstallerService } from './InstallerService';

const mockStore: Record<string, string> = {};

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (filePath: string, contents: string) => {
    mockStore[filePath] = contents;
  }),
  readTextFile: vi.fn(async (filePath: string) => {
    if (!mockStore[filePath]) throw new Error('File not found');
    return mockStore[filePath];
  }),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async (target: string) => {
    if (mockStore[target]) return true;
    return Object.keys(mockStore).some(k => k.startsWith(target));
  })
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => ({ stdout: '/home/testuser' }))
}));

describe('InstallerService (Linux & Cross-Platform)', () => {
  const installer = InstallerService.getInstance();
  const cliTarget = '/home/testuser/.local/bin/sentinel';
  const servicesDir = '/home/testuser/.local/share/nautilus/scripts';
  const vscodeSettings = '/home/testuser/.config/Code/User/settings.json';
  const cursorSettings = '/home/testuser/.config/Cursor/User/settings.json';

  beforeEach(() => {
    for (const k in mockStore) delete mockStore[k];
  });

  it('installs the sentinel command line executable to Linux target directory', async () => {
    const res = await installer.installCli('#!/bin/bash\necho "test"', cliTarget);
    expect(res.success).toBe(true);
    expect(mockStore[cliTarget]).toContain('echo "test"');
  });

  it('generates Linux file manager Open in Sentinel script', async () => {
    const res = await installer.enableFinderIntegration(servicesDir);
    expect(res.success).toBe(true);
    expect(mockStore[`${servicesDir}/Open in Sentinel Terminal`]).toBeDefined();
    expect(mockStore[`${servicesDir}/Open in Sentinel Terminal`]).toContain('sentinel-terminal');
  });

  it('injects Sentinel Terminal profile into VS Code settings.json cleanly for Linux', async () => {
    mockStore[vscodeSettings] = JSON.stringify({ "editor.fontSize": 14 });

    const res = await installer.configureVsCodeIntegration(vscodeSettings);
    expect(res.success).toBe(true);

    const saved = JSON.parse(mockStore[vscodeSettings]);
    expect(saved['editor.fontSize']).toBe(14);
    expect(saved['terminal.integrated.profiles.linux']['Sentinel Terminal'].path).toBe('sentinel');
  });

  it('injects Sentinel Terminal profile into Cursor IDE settings.json for Linux', async () => {
    const res = await installer.configureCursorIntegration(cursorSettings);
    expect(res.success).toBe(true);

    const saved = JSON.parse(mockStore[cursorSettings]);
    expect(saved['terminal.integrated.profiles.linux']['Sentinel Terminal']).toBeDefined();
    expect(saved['terminal.integrated.profiles.linux']['Sentinel Terminal'].path).toBe('sentinel');
  });

  it('accurately verifies status of all desktop integration components', async () => {
    await installer.installCli('echo "cli"', cliTarget);
    await installer.configureVsCodeIntegration(vscodeSettings);

    const status = await installer.checkStatus({
      cliPath: cliTarget,
      servicesDir: `${servicesDir}/Open in Sentinel Terminal`,
      vscodePath: vscodeSettings,
      cursorPath: cursorSettings
    });

    expect(status.cliInstalled).toBe(true);
    expect(status.finderEnabled).toBe(false);
    expect(status.vscodeConfigured).toBe(true);
    expect(status.cursorConfigured).toBe(false);
  });
});
