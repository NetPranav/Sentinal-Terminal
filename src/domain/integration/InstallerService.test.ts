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

describe('InstallerService', () => {
  const installer = InstallerService.getInstance();
  const cliTarget = '/usr/local/bin/sentinel';
  const servicesDir = '/Library/Services';
  const vscodeSettings = '/Code/settings.json';
  const cursorSettings = '/Cursor/settings.json';

  beforeEach(() => {
    for (const k in mockStore) delete mockStore[k];
  });

  it('installs the sentinel command line executable to binary target directory', async () => {
    const res = await installer.installCli('#!/bin/bash\necho "test"', cliTarget);
    expect(res.success).toBe(true);
    expect(mockStore[cliTarget]).toContain('echo "test"');
  });

  it('generates the Finder Quick Action Open in Sentinel workflow service', async () => {
    const res = await installer.enableFinderIntegration(servicesDir);
    expect(res.success).toBe(true);
    expect(mockStore[`${servicesDir}/Open in Sentinel.workflow/Contents/Info.plist`]).toBeDefined();
    expect(mockStore[`${servicesDir}/Open in Sentinel.workflow/Contents/document.wflow`]).toContain('sentinel://open');
  });

  it('injects Sentinel Terminal profile into VS Code settings.json cleanly', async () => {
    mockStore[vscodeSettings] = JSON.stringify({ "editor.fontSize": 14 });

    const res = await installer.configureVsCodeIntegration(vscodeSettings);
    expect(res.success).toBe(true);

    const saved = JSON.parse(mockStore[vscodeSettings]);
    expect(saved['editor.fontSize']).toBe(14);
    expect(saved['terminal.integrated.profiles.osx']['Sentinel Terminal'].path).toContain('Sentinel Terminal.app');
  });

  it('injects Sentinel Terminal profile into Cursor IDE settings.json', async () => {
    const res = await installer.configureCursorIntegration(cursorSettings);
    expect(res.success).toBe(true);

    const saved = JSON.parse(mockStore[cursorSettings]);
    expect(saved['terminal.integrated.profiles.osx']['Sentinel Terminal']).toBeDefined();
  });

  it('accurately verifies status of all desktop integration components', async () => {
    await installer.installCli('echo "cli"', cliTarget);
    await installer.configureVsCodeIntegration(vscodeSettings);

    const status = await installer.checkStatus({
      cliPath: cliTarget,
      servicesDir: `${servicesDir}/Open in Sentinel.workflow`,
      vscodePath: vscodeSettings,
      cursorPath: cursorSettings
    });

    expect(status.cliInstalled).toBe(true);
    expect(status.finderEnabled).toBe(false);
    expect(status.vscodeConfigured).toBe(true);
    expect(status.cursorConfigured).toBe(false);
  });
});
