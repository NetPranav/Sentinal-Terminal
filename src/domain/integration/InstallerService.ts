import { writeTextFile, readTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { getPlatform, isMacOS, isLinux } from '../../shared/platform';

export interface IntegrationStatus {
  cliInstalled: boolean;
  finderEnabled: boolean; // Preserved for API compatibility; represents Desktop/File Manager integration
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
  if (isMacOS()) {
    return '/Users/pranav';
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
   * Install the 'sentinel' command line executable to target binary folder (default: /usr/local/bin/sentinel or ~/.local/bin/sentinel).
   */
  public async installCli(cliSourceContent?: string, targetPath = '/usr/local/bin/sentinel'): Promise<{ success: boolean; error?: string; installedPath?: string }> {
    try {
      const dir = getDirname(targetPath);
      const dirExists = await exists(dir);
      if (!dirExists) {
        await mkdir(dir, { recursive: true });
      }

      const scriptContent = cliSourceContent || `#!/usr/bin/env bash
# Sentinel Terminal CLI Launcher
target="$1"
if [ -z "$target" ]; then target="."; fi
target_dir=$(cd "$target" 2>/dev/null && pwd || echo "$target")

if [ "$target" == "--new-tab" ]; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "sentinel://new-tab?path=$(pwd)" 2>/dev/null || exit 0
  else
    open "sentinel://new-tab?path=$(pwd)" 2>/dev/null || exit 0
  fi
  exit 0
fi

if [ "$target" == "--split" ]; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "sentinel://split?path=$(pwd)" 2>/dev/null || exit 0
  else
    open "sentinel://split?path=$(pwd)" 2>/dev/null || exit 0
  fi
  exit 0
fi

if which sentinel-terminal >/dev/null 2>&1; then
  sentinel-terminal "$target_dir" &
elif which tauri-app >/dev/null 2>&1; then
  tauri-app "$target_dir" &
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "sentinel://open?path=$target_dir" 2>/dev/null || xdg-open "$target_dir" 2>/dev/null
else
  open "sentinel://open?path=$target_dir" 2>/dev/null || open -a "Sentinel Terminal" "$target_dir" 2>/dev/null
fi
`;

      await writeTextFile(targetPath, scriptContent);
      return { success: true, installedPath: targetPath };
    } catch (e: any) {
      if ((e?.code === 'EACCES' || String(e).includes('permission denied')) && targetPath.startsWith('/usr/local/bin')) {
        const fallbackPath = joinPath(getHomeDir(), '.local', 'bin', 'sentinel');
        return this.installCli(cliSourceContent, fallbackPath);
      }
      return { success: false, error: e?.message || String(e) };
    }
  }

  /**
   * Enable Linux Desktop Entry (.desktop) and File Manager integrations.
   */
  public async enableLinuxDesktopIntegration(targetAppDir?: string, targetScriptsDir?: string): Promise<{ success: boolean; desktopPath: string; error?: string }> {
    const appDir = targetAppDir || joinPath(getHomeDir(), '.local', 'share', 'applications');
    const desktopPath = joinPath(appDir, 'sentinel.desktop');
    const scriptsDir = targetScriptsDir || joinPath(getHomeDir(), '.local', 'share', 'nautilus', 'scripts');
    const scriptPath = joinPath(scriptsDir, 'Open in Sentinel');

    try {
      if (!(await exists(appDir))) {
        await mkdir(appDir, { recursive: true });
      }

      const desktopFileContent = `[Desktop Entry]
Name=Sentinel Terminal
Comment=AI-Native Intelligent Terminal
Exec=sentinel %U
Icon=utilities-terminal
Terminal=false
Type=Application
Categories=System;TerminalEmulator;Development;
MimeType=inode/directory;x-scheme-handler/sentinel;
Actions=NewWindow;NewTab;

[Desktop Action NewWindow]
Name=New Window
Exec=sentinel

[Desktop Action NewTab]
Name=New Tab
Exec=sentinel --new-tab
`;
      await writeTextFile(desktopPath, desktopFileContent);

      try {
        if (!(await exists(scriptsDir))) {
          await mkdir(scriptsDir, { recursive: true });
        }
        const nautilusScriptContent = `#!/usr/bin/env bash
target="\${NAUTILUS_SCRIPT_SELECTED_FILE_PATHS:-\$PWD}"
sentinel "\$target"
`;
        await writeTextFile(scriptPath, nautilusScriptContent);
      } catch {
        // Nautilus scripts directory optional
      }

      return { success: true, desktopPath };
    } catch (e: any) {
      return { success: false, desktopPath, error: e?.message || String(e) };
    }
  }

  /**
   * Enable macOS Finder Quick Action service ("Open in Sentinel").
   */
  public async enableFinderIntegration(targetServicesDir?: string): Promise<{ success: boolean; workflowPath: string; error?: string }> {
    if (isLinux()) {
      const res = await this.enableLinuxDesktopIntegration();
      return { success: res.success, workflowPath: res.desktopPath, error: res.error };
    }

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

      const profileKey = isMacOS() ? 'terminal.integrated.profiles.osx' : 'terminal.integrated.profiles.linux';

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
    const defaultPath = isMacOS()
      ? joinPath(getHomeDir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json')
      : joinPath(getHomeDir(), '.config', 'Code', 'User', 'settings.json');
    const settingsPath = mockSettingsPath || defaultPath;
    const exePath = isMacOS()
      ? '/Applications/Sentinel Terminal.app/Contents/MacOS/Sentinel Terminal'
      : (await exists('/usr/local/bin/sentinel') ? '/usr/local/bin/sentinel' : joinPath(getHomeDir(), '.local', 'bin', 'sentinel'));
    return this.updateIdeSettings(settingsPath, 'Sentinel Terminal', exePath);
  }

  /**
   * Configure Cursor IDE integrated terminal profile.
   */
  public async configureCursorIntegration(mockSettingsPath?: string): Promise<{ success: boolean; error?: string }> {
    const defaultPath = isMacOS()
      ? joinPath(getHomeDir(), 'Library', 'Application Support', 'Cursor', 'User', 'settings.json')
      : joinPath(getHomeDir(), '.config', 'Cursor', 'User', 'settings.json');
    const settingsPath = mockSettingsPath || defaultPath;
    const exePath = isMacOS()
      ? '/Applications/Sentinel Terminal.app/Contents/MacOS/Sentinel Terminal'
      : (await exists('/usr/local/bin/sentinel') ? '/usr/local/bin/sentinel' : joinPath(getHomeDir(), '.local', 'bin', 'sentinel'));
    return this.updateIdeSettings(settingsPath, 'Sentinel Terminal', exePath);
  }

  /**
   * Check status of all system integrations.
   */
  public async checkStatus(opts?: { cliPath?: string; servicesDir?: string; vscodePath?: string; cursorPath?: string }): Promise<IntegrationStatus> {
    const home = getHomeDir();
    const cliPath = opts?.cliPath || '/usr/local/bin/sentinel';
    const servicesDir = opts?.servicesDir || (
      isMacOS()
        ? joinPath(home, 'Library', 'Services', 'Open in Sentinel.workflow')
        : joinPath(home, '.local', 'share', 'applications', 'sentinel.desktop')
    );
    const vscodePath = opts?.vscodePath || (
      isMacOS()
        ? joinPath(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json')
        : joinPath(home, '.config', 'Code', 'User', 'settings.json')
    );
    const cursorPath = opts?.cursorPath || (
      isMacOS()
        ? joinPath(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json')
        : joinPath(home, '.config', 'Cursor', 'User', 'settings.json')
    );

    const cliInstalled = (await exists(cliPath)) || (await exists(joinPath(home, '.local', 'bin', 'sentinel')));
    const finderEnabled = await exists(servicesDir);
    
    const profileKey = isMacOS() ? 'terminal.integrated.profiles.osx' : 'terminal.integrated.profiles.linux';

    let vscodeConfigured = false;
    if (await exists(vscodePath)) {
      try {
        const data = JSON.parse(await readTextFile(vscodePath));
        vscodeConfigured = !!data[profileKey]?.['Sentinel Terminal'] || !!data['terminal.integrated.profiles.osx']?.['Sentinel Terminal'] || !!data['terminal.integrated.profiles.linux']?.['Sentinel Terminal'];
      } catch (e) {}
    }

    let cursorConfigured = false;
    if (await exists(cursorPath)) {
      try {
        const data = JSON.parse(await readTextFile(cursorPath));
        cursorConfigured = !!data[profileKey]?.['Sentinel Terminal'] || !!data['terminal.integrated.profiles.osx']?.['Sentinel Terminal'] || !!data['terminal.integrated.profiles.linux']?.['Sentinel Terminal'];
      } catch (e) {}
    }

    return { cliInstalled, finderEnabled, vscodeConfigured, cursorConfigured };
  }
}
