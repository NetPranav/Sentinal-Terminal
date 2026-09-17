import { writeTextFile, readTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { isLinux } from '../../shared/platform';

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

export const getHomeDir = (): string => {
  if (typeof process !== 'undefined' && process.env?.HOME) {
    return process.env.HOME;
  }
  return '/home/user';
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
   * Helper to safely get the current user's home directory across Tauri and Node/Vitest runtimes.
   */
  public async getResolvedHomeDir(): Promise<string> {
    if (typeof process !== 'undefined' && process.env?.HOME) {
      return process.env.HOME;
    }
    try {
      const res = await invoke<{ stdout: string }>('execute_command', {
        command: 'sh',
        args: ['-c', 'echo $HOME']
      });
      if (res?.stdout?.trim()) return res.stdout.trim();
    } catch {
      // Fallback
    }
    return getHomeDir();
  }

  /**
   * Install the 'sentinel' command line executable to target binary folder.
   * On Linux, defaults to rootless `~/.local/bin/sentinel` with fallback to `/usr/local/bin/sentinel`.
   */
  public async installCli(cliSourceContent?: string, targetPath?: string): Promise<{ success: boolean; error?: string }> {
    const home = await this.getResolvedHomeDir();
    const finalTargetPath = targetPath || (isLinux()
      ? joinPath(home, '.local', 'bin', 'sentinel')
      : '/usr/local/bin/sentinel');

    try {
      const dir = getDirname(finalTargetPath);
      const dirExists = await exists(dir);
      if (!dirExists) {
        await mkdir(dir, { recursive: true });
      }

      const scriptContent = cliSourceContent || (isLinux()
        ? `#!/usr/bin/env bash
# Sentinel Terminal CLI Launcher (Linux)
APP_BIN="sentinel-terminal"
target="$1"
if [ -z "$target" ]; then target="."; fi

if [ "$target" == "--new-tab" ]; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "sentinel://new-tab?path=$(pwd)" 2>/dev/null || "$APP_BIN" --new-tab 2>/dev/null || true
  else
    "$APP_BIN" --new-tab 2>/dev/null || true
  fi
  exit 0
fi

if [ "$target" == "--split" ]; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "sentinel://split?path=$(pwd)" 2>/dev/null || "$APP_BIN" --split 2>/dev/null || true
  else
    "$APP_BIN" --split 2>/dev/null || true
  fi
  exit 0
fi

resolved_path=$(cd "$target" 2>/dev/null && pwd || echo "$target")
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "sentinel://open?path=$resolved_path" 2>/dev/null || "$APP_BIN" "$resolved_path" 2>/dev/null || sentinel "$resolved_path" 2>/dev/null || true
else
  "$APP_BIN" "$resolved_path" 2>/dev/null || sentinel "$resolved_path" 2>/dev/null || true
fi
`
        : `#!/usr/bin/env bash
# Sentinel Terminal CLI Launcher (macOS)
APP_NAME="Sentinel Terminal"
target="$1"
if [ -z "$target" ]; then target="."; fi
if [ "$target" == "--new-tab" ]; then open "sentinel://new-tab?path=$(pwd)"; exit 0; fi
if [ "$target" == "--split" ]; then open "sentinel://split?path=$(pwd)"; exit 0; fi
open "sentinel://open?path=$(cd "$target" 2>/dev/null && pwd || echo "$target")" 2>/dev/null || open -a "$APP_NAME" "$target"
`);

      await writeTextFile(finalTargetPath, scriptContent);

      // Apply executable permission on Linux
      if (isLinux()) {
        try {
          await invoke('execute_command', {
            command: 'chmod',
            args: ['+x', finalTargetPath]
          });
        } catch {
          // Non-fatal if running in mocked environment
        }
      }

      return { success: true };
    } catch (e: any) {
      if ((e?.code === 'EACCES' || String(e).includes('permission denied')) && finalTargetPath.startsWith('/usr/local/bin')) {
        const fallbackPath = joinPath(home, '.local', 'bin', 'sentinel');
        return this.installCli(cliSourceContent, fallbackPath);
      }
      return { success: false, error: e?.message || String(e) };
    }
  }

  /**
   * Enable Linux File Manager / macOS Finder context action ("Open in Sentinel").
   */
  public async enableFinderIntegration(targetServicesDir?: string): Promise<{ success: boolean; workflowPath: string; error?: string }> {
    const home = await this.getResolvedHomeDir();

    if (isLinux()) {
      const scriptDir = targetServicesDir || joinPath(home, '.local', 'share', 'nautilus', 'scripts');
      const scriptPath = joinPath(scriptDir, 'Open in Sentinel Terminal');
      try {
        if (!(await exists(scriptDir))) {
          await mkdir(scriptDir, { recursive: true });
        }
        const scriptContent = `#!/usr/bin/env bash
target="\${NAUTILUS_SCRIPT_SELECTED_FILE_PATHS:-\$PWD}"
target=\$(echo "\$target" | head -n 1)
if [ -z "\$target" ] || [ ! -d "\$target" ]; then target="\$PWD"; fi
command -v sentinel-terminal >/dev/null 2>&1 && sentinel-terminal "\$target" & || command -v sentinel >/dev/null 2>&1 && sentinel "\$target" &
`;
        await writeTextFile(scriptPath, scriptContent);
        try {
          await invoke('execute_command', { command: 'chmod', args: ['+x', scriptPath] });
        } catch {}

        // Also install Nemo script if folder exists
        const nemoDir = joinPath(home, '.local', 'share', 'nemo', 'scripts');
        try {
          if (await exists(joinPath(home, '.local', 'share', 'nemo'))) {
            if (!(await exists(nemoDir))) await mkdir(nemoDir, { recursive: true });
            await writeTextFile(joinPath(nemoDir, 'Open in Sentinel Terminal'), scriptContent);
          }
        } catch {}

        return { success: true, workflowPath: scriptPath };
      } catch (e: any) {
        return { success: false, workflowPath: scriptPath, error: e?.message || String(e) };
      }
    }

    // macOS Finder Quick Action Workflow
    const servicesDir = targetServicesDir || joinPath(home, 'Library', 'Services');
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
        } catch {
          config = {};
        }
      }

      const profileKey = isLinux() ? 'terminal.integrated.profiles.linux' : 'terminal.integrated.profiles.osx';

      if (!config[profileKey]) {
        config[profileKey] = {};
      }

      config[profileKey][profileTitle] = {
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
    const home = await this.getResolvedHomeDir();
    const settingsPath = mockSettingsPath || (isLinux()
      ? joinPath(home, '.config', 'Code', 'User', 'settings.json')
      : joinPath(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json'));

    const binPath = isLinux() ? 'sentinel' : '/Applications/Sentinel Terminal.app/Contents/MacOS/Sentinel Terminal';
    return this.updateIdeSettings(settingsPath, 'Sentinel Terminal', binPath);
  }

  /**
   * Configure Cursor IDE integrated terminal profile.
   */
  public async configureCursorIntegration(mockSettingsPath?: string): Promise<{ success: boolean; error?: string }> {
    const home = await this.getResolvedHomeDir();
    const settingsPath = mockSettingsPath || (isLinux()
      ? joinPath(home, '.config', 'Cursor', 'User', 'settings.json')
      : joinPath(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json'));

    const binPath = isLinux() ? 'sentinel' : '/Applications/Sentinel Terminal.app/Contents/MacOS/Sentinel Terminal';
    return this.updateIdeSettings(settingsPath, 'Sentinel Terminal', binPath);
  }

  /**
   * Check status of all system integrations across Linux and macOS.
   */
  public async checkStatus(opts?: { cliPath?: string; servicesDir?: string; vscodePath?: string; cursorPath?: string }): Promise<IntegrationStatus> {
    const home = await this.getResolvedHomeDir();

    const cliPath = opts?.cliPath || (isLinux() ? joinPath(home, '.local', 'bin', 'sentinel') : '/usr/local/bin/sentinel');
    const servicesDir = opts?.servicesDir || (isLinux()
      ? joinPath(home, '.local', 'share', 'nautilus', 'scripts', 'Open in Sentinel Terminal')
      : joinPath(home, 'Library', 'Services', 'Open in Sentinel.workflow'));

    const vscodePath = opts?.vscodePath || (isLinux()
      ? joinPath(home, '.config', 'Code', 'User', 'settings.json')
      : joinPath(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json'));

    const cursorPath = opts?.cursorPath || (isLinux()
      ? joinPath(home, '.config', 'Cursor', 'User', 'settings.json')
      : joinPath(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json'));

    const cliInstalled = (await exists(cliPath))
      || (await exists(joinPath(home, '.local', 'bin', 'sentinel')))
      || (await exists('/usr/local/bin/sentinel'))
      || (await exists('/usr/bin/sentinel-terminal'))
      || (await exists('/usr/bin/sentinel'));

    const finderEnabled = (await exists(servicesDir))
      || (await exists(joinPath(home, '.local', 'share', 'applications', 'com.pranav.sentinel-terminal.desktop')));

    const profileKey = isLinux() ? 'terminal.integrated.profiles.linux' : 'terminal.integrated.profiles.osx';

    let vscodeConfigured = false;
    if (await exists(vscodePath)) {
      try {
        const data = JSON.parse(await readTextFile(vscodePath));
        vscodeConfigured = !!(data[profileKey]?.['Sentinel Terminal'] || data['terminal.integrated.profiles.linux']?.['Sentinel Terminal'] || data['terminal.integrated.profiles.osx']?.['Sentinel Terminal']);
      } catch {}
    }

    let cursorConfigured = false;
    if (await exists(cursorPath)) {
      try {
        const data = JSON.parse(await readTextFile(cursorPath));
        cursorConfigured = !!(data[profileKey]?.['Sentinel Terminal'] || data['terminal.integrated.profiles.linux']?.['Sentinel Terminal'] || data['terminal.integrated.profiles.osx']?.['Sentinel Terminal']);
      } catch {}
    }

    return { cliInstalled, finderEnabled, vscodeConfigured, cursorConfigured };
  }
}
