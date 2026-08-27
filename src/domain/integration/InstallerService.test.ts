import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstallerService } from './InstallerService';
import { isMacOS } from '../../shared/platform';

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
  const linuxAppDir = '/home/user/.local/share/applications';
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

  it('generates Linux desktop entry file and file manager integration script', async () => {
    const res = await installer.enableLinuxDesktopIntegration(linuxAppDir, '/home/user/.local/share/nautilus/scripts');
    expect(res.success).toBe(true);
    expect(mockStore[`${linuxAppDir}/sentinel.desktop`]).toBeDefined();
    expect(mockStore[`${linuxAppDir}/sentinel.desktop`]).toContain('[Desktop Entry]');
    expect(mockStore[`${linuxAppDir}/sentinel.desktop`]).toContain('Exec=sentinel %U');
    expect(mockStore[`/home/user/.local/share/nautilus/scripts/Open in Sentinel`]).toBeDefined();
  });

  it('generates the Finder Quick Action Open in Sentinel workflow service on macOS or desktop entry on Linux', async () => {
    const res = await installer.enableFinderIntegration(servicesDir);
    expect(res.success).toBe(true);
    if (isMacOS()) {
      expect(mockStore[`${servicesDir}/Open in Sentinel.workflow/Contents/Info.plist`]).toBeDefined();
      expect(mockStore[`${servicesDir}/Open in Sentinel.workflow/Contents/document.wflow`]).toContain('sentinel://open');
    } else {
      expect(res.workflowPath).toContain('sentinel.desktop');
    }
  });

  it('injects Sentinel Terminal profile into VS Code settings.json cleanly', async () => {
    mockStore[vscodeSettings] = JSON.stringify({ "editor.fontSize": 14 });

    const res = await installer.configureVsCodeIntegration(vscodeSettings);
    expect(res.success).toBe(true);

    const saved = JSON.parse(mockStore[vscodeSettings]);
    expect(saved['editor.fontSize']).toBe(14);
    const profileKey = isMacOS() ? 'terminal.integrated.profiles.osx' : 'terminal.integrated.profiles.linux';
    expect(saved[profileKey]['Sentinel Terminal']).toBeDefined();
  });

  it('injects Sentinel Terminal profile into Cursor IDE settings.json', async () => {
    const res = await installer.configureCursorIntegration(cursorSettings);
    expect(res.success).toBe(true);

    const saved = JSON.parse(mockStore[cursorSettings]);
    const profileKey = isMacOS() ? 'terminal.integrated.profiles.osx' : 'terminal.integrated.profiles.linux';
    expect(saved[profileKey]['Sentinel Terminal']).toBeDefined();
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
