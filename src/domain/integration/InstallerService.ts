import { writeTextFile, readTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';

export interface IntegrationStatus {
  cliInstalled: boolean;
  finderEnabled: boolean;
  vscodeConfigured: boolean;
  cursorConfigured: boolean;
}

const joinPath = (...parts: string[]): string => {
  return parts
    .filter(p => !!p)
    .map((p, idx) => {
      if (idx === 0) return p.replace(/\/+$/, '');
      return p.replace(/^\/+|\/+$/g, '');
    })
    .join('/') || '/';
};

const getDirname = (p: string): string => {
  const parts = p.replace(/\/+$/, '').split('/');
  parts.pop();
  return parts.join('/') || '/';
};

const getHomeDir = (): string => {
  if (typeof process !== 'undefined' && process.env?.HOME) {
    return process.env.HOME;
  }
  return '/Users/pranav'; // Standard developer fallback in browser webview environment
};

export class InstallerService {
  private static instance: InstallerService;

  private constructor() {}

  public static getInstance(): InstallerService {
    if (!InstallerService.instance) {
      InstallerService.instance = new InstallerService();
    }
    return InstallerService.instance;
  }

  /**
   * Install the 'sentinel' command line executable to target binary folder (default: /usr/local/bin/sentinel).
   */
  public async installCli(cliSourceContent?: string, targetPath = '/usr/local/bin/sentinel'): Promise<{ success: boolean; error?: string }> {
    try {
      const dir = getDirname(targetPath);
      const dirExists = await exists(dir);
      if (!dirExists) {
        await mkdir(dir, { recursive: true });
      }

      const scriptContent = cliSourceContent || `#!/usr/bin/env bash
# Sentinel Terminal CLI Launcher
APP_NAME="Sentinel Terminal"
target="$1"
if [ -z "$target" ]; then target="."; fi
if [ "$target" == "--new-tab" ]; then open "sentinel://new-tab?path=$(pwd)"; exit 0; fi
if [ "$target" == "--split" ]; then open "sentinel://split?path=$(pwd)"; exit 0; fi
open "sentinel://open?path=$(cd "$target" 2>/dev/null && pwd || echo "$target")" 2>/dev/null || open -a "$APP_NAME" "$target"
`;

      await writeTextFile(targetPath, scriptContent);
      return { success: true };
    } catch (e: any) {
      if ((e?.code === 'EACCES' || String(e).includes('permission denied')) && targetPath.startsWith('/usr/local/bin')) {
        const fallbackPath = joinPath(getHomeDir(), '.local', 'bin', 'sentinel');
        return this.installCli(cliSourceContent, fallbackPath);
      }
      return { success: false, error: e?.message || String(e) };
    }
  }

  /**
   * Enable macOS Finder Quick Action service ("Open in Sentinel").
   */
  public async enableFinderIntegration(targetServicesDir?: string): Promise<{ success: boolean; workflowPath: string; error?: string }> {
    const servicesDir = targetServicesDir || joinPath(getHomeDir(), 'Library', 'Services');
    const workflowPath = joinPath(servicesDir, 'Open in Sentinel.workflow');

    try {
      if (!(await exists(servicesDir))) {
        await mkdir(servicesDir, { recursive: true });
      }

      const contentsDir = joinPath(workflowPath, 'Contents');
      if (!(await exists(contentsDir))) {
        await mkdir(contentsDir, { recursive: true });
      }

      const infoPlistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Open in Sentinel</string>
  <key>CFBundleIdentifier</key>
  <string>com.sentinel.services.open</string>
  <key>NSServices</key>
  <array>
    <dict>
      <key>NSMenuItem</key>
      <dict>
        <key>default</key>
        <string>Open in Sentinel</string>
      </dict>
      <key>NSMessage</key>
      <string>runWorkflowAsService</string>
      <key>NSSendTypes</key>
      <array>
        <string>public.folder</string>
      </array>
    </dict>
  </array>
</dict>
</plist>`;
      await writeTextFile(joinPath(contentsDir, 'Info.plist'), infoPlistContent);

      const documentStub = `open "sentinel://open?path=$1"`;
      await writeTextFile(joinPath(contentsDir, 'document.wflow'), documentStub);

      return { success: true, workflowPath };
    } catch (e: any) {
      return { success: false, workflowPath, error: e?.message || String(e) };
    }
  }

  /**
   * Helper method to inject custom profile into IDE settings.json cleanly.
   */
  private async updateIdeSettings(settingsPath: string, profileTitle: string, appPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const dir = getDirname(settingsPath);
      if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true });
      }

      let config: any = {};
      if (await exists(settingsPath)) {
        try {
          const content = await readTextFile(settingsPath);
          config = JSON.parse(content);
        } catch (err) {
          config = {};
        }
      }

      if (!config['terminal.integrated.profiles.osx']) {
        config['terminal.integrated.profiles.osx'] = {};
      }

      config['terminal.integrated.profiles.osx'][profileTitle] = {
        path: appPath,
        icon: 'terminal',
        overrideName: true
      };

      await writeTextFile(settingsPath, JSON.stringify(config, null, 2));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  /**
   * Configure VS Code integrated terminal profile.
   */
  public async configureVsCodeIntegration(mockSettingsPath?: string): Promise<{ success: boolean; error?: string }> {
    const settingsPath = mockSettingsPath || joinPath(getHomeDir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
    return this.updateIdeSettings(settingsPath, 'Sentinel Terminal', '/Applications/Sentinel Terminal.app/Contents/MacOS/Sentinel Terminal');
  }

  /**
   * Configure Cursor IDE integrated terminal profile.
   */
  public async configureCursorIntegration(mockSettingsPath?: string): Promise<{ success: boolean; error?: string }> {
    const settingsPath = mockSettingsPath || joinPath(getHomeDir(), 'Library', 'Application Support', 'Cursor', 'User', 'settings.json');
    return this.updateIdeSettings(settingsPath, 'Sentinel Terminal', '/Applications/Sentinel Terminal.app/Contents/MacOS/Sentinel Terminal');
  }

  /**
   * Check status of all system integrations.
   */
  public async checkStatus(opts?: { cliPath?: string; servicesDir?: string; vscodePath?: string; cursorPath?: string }): Promise<IntegrationStatus> {
    const cliPath = opts?.cliPath || '/usr/local/bin/sentinel';
    const servicesDir = opts?.servicesDir || joinPath(getHomeDir(), 'Library', 'Services', 'Open in Sentinel.workflow');
    const vscodePath = opts?.vscodePath || joinPath(getHomeDir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
    const cursorPath = opts?.cursorPath || joinPath(getHomeDir(), 'Library', 'Application Support', 'Cursor', 'User', 'settings.json');

    const cliInstalled = (await exists(cliPath)) || (await exists(joinPath(getHomeDir(), '.local', 'bin', 'sentinel')));
    const finderEnabled = await exists(servicesDir);
    
    let vscodeConfigured = false;
    if (await exists(vscodePath)) {
      try {
        const data = JSON.parse(await readTextFile(vscodePath));
        vscodeConfigured = !!data['terminal.integrated.profiles.osx']?.['Sentinel Terminal'];
      } catch (e) {}
    }

    let cursorConfigured = false;
    if (await exists(cursorPath)) {
      try {
        const data = JSON.parse(await readTextFile(cursorPath));
        cursorConfigured = !!data['terminal.integrated.profiles.osx']?.['Sentinel Terminal'];
      } catch (e) {}
    }

    return { cliInstalled, finderEnabled, vscodeConfigured, cursorConfigured };
  }
}
