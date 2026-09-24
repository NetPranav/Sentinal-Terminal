import { writeTextFile, readTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { isLinux } from '../../shared/platform';

export interface IntegrationStatus {
  cliInstalled: boolean;
  finderEnabled: boolean;
  vscodeConfigured: boolean;
  cursorConfigured: boolean;
  localBinInPath?: boolean;
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
    try {
      const res = await invoke<{ stdout: string }>('execute_command', {
        command: 'sh',
        args: ['-c', 'echo $HOME']
      });
      if (res?.stdout?.trim()) return res.stdout.trim();
    } catch {
      // Fallback
    }
    if (typeof process !== 'undefined' && process.env?.HOME) {
      return process.env.HOME;
    }
    return getHomeDir();
  }

  /**
   * Discover real executable path for Sentinel Terminal.
   */
  public async getAppBinaryPath(): Promise<string> {
    try {
      const res = await invoke<string>('get_app_binary_path');
      if (res && res.trim()) return res.trim();
    } catch {}
    return 'sentinel-terminal';
  }

  /**
   * Check whether ~/.local/bin is present in the current process environment PATH.
   */
  public async isLocalBinInPath(): Promise<boolean> {
    const home = await this.getResolvedHomeDir();
    const localBin = joinPath(home, '.local', 'bin');
    if (typeof process !== 'undefined' && process.env?.PATH) {
      const paths = process.env.PATH.split(':');
      if (paths.includes(localBin) || paths.includes('~/.local/bin')) return true;
    }
    try {
      const res = await invoke<{ stdout: string }>('execute_command', {
        command: 'sh',
        args: ['-c', 'echo $PATH']
      });
      if (res?.stdout) {
        const paths = res.stdout.trim().split(':');
        return paths.includes(localBin) || paths.includes('~/.local/bin');
      }
    } catch {}
    return false;
  }

  /**
   * Generate and install the sentinel-shell PTY wrapper for IDE integrated terminals.
   */
  public async ensureSentinelShellWrapper(home: string): Promise<string> {
    const shellWrapperPath = joinPath(home, '.local', 'bin', 'sentinel-shell');
    try {
      const binDir = getDirname(shellWrapperPath);
      if (!(await exists(binDir))) {
        await mkdir(binDir, { recursive: true });
      }

      const script = `#!/usr/bin/env bash
# Sentinel Terminal IDE Integrated Shell Profile
# Runs within VS Code / Cursor integrated terminal (node-pty)

if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  export PATH="$HOME/.local/bin:$PATH"
fi

export SENTINEL_IDE_INTEGRATED=1
export TERMINAL_EMULATOR="SentinelTerminal"

if [ -f "$HOME/.sentinel/env" ]; then
  source "$HOME/.sentinel/env" 2>/dev/null || true
fi

USER_SHELL="\${SHELL:-/bin/bash}"
if [ "$USER_SHELL" = "$0" ] || [ ! -x "$USER_SHELL" ]; then
  USER_SHELL="/bin/bash"
fi

exec "$USER_SHELL" "$@"
`;
      await writeTextFile(shellWrapperPath, script);
      try {
        await invoke('execute_command', {
          command: 'chmod',
          args: ['+x', shellWrapperPath]
        });
      } catch {}
    } catch {}
    return shellWrapperPath;
  }

  /**
   * Install FreeDesktop application entry with directory and URL scheme handlers.
   */
  public async ensureDesktopEntry(home: string): Promise<string> {
    const desktopPath = joinPath(home, '.local', 'share', 'applications', 'sentinel-terminal.desktop');
    try {
      const appsDir = getDirname(desktopPath);
      if (!(await exists(appsDir))) {
        await mkdir(appsDir, { recursive: true });
      }

      const desktopContent = `[Desktop Entry]
Name=Sentinel Terminal
Comment=Autonomous AI-Native Linux Terminal Copilot
GenericName=Terminal Emulator
Exec=sentinel-terminal %U
Icon=sentinel-terminal
Type=Application
Terminal=false
StartupNotify=true
StartupWMClass=sentinel-terminal
Categories=System;TerminalEmulator;Development;Utility;
Keywords=terminal;shell;ai;copilot;bash;pty;llama;
MimeType=inode/directory;x-scheme-handler/sentinel;
Actions=NewWindow;

[Desktop Action NewWindow]
Name=Open New Window
Exec=sentinel-terminal
`;
      await writeTextFile(desktopPath, desktopContent);

      // Register MIME handlers if tools are present
      try {
        await invoke('execute_command', {
          command: 'update-desktop-database',
          args: [appsDir]
        });
      } catch {}
      try {
        await invoke('execute_command', {
          command: 'xdg-mime',
          args: ['default', 'sentinel-terminal.desktop', 'x-scheme-handler/sentinel']
        });
      } catch {}
    } catch {}
    return desktopPath;
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

      let detectedAppBin = 'sentinel-terminal';
      if (isLinux()) {
        detectedAppBin = await this.getAppBinaryPath();
      }

      const scriptContent = cliSourceContent || (isLinux()
        ? `#!/usr/bin/env bash
# Sentinel Terminal CLI Launcher (Linux)
set -e

# Multi-tier binary resolution
CANDIDATE_BIN="${detectedAppBin}"
if [ -n "$CANDIDATE_BIN" ] && [ -x "$CANDIDATE_BIN" ] && [ "$CANDIDATE_BIN" != "sentinel-terminal" ]; then
  APP_BIN="$CANDIDATE_BIN"
elif command -v sentinel-terminal >/dev/null 2>&1; then
  APP_BIN="$(command -v sentinel-terminal)"
elif [ -x "/usr/bin/sentinel-terminal" ]; then
  APP_BIN="/usr/bin/sentinel-terminal"
elif [ -x "/usr/local/bin/sentinel-terminal" ]; then
  APP_BIN="/usr/local/bin/sentinel-terminal"
elif [ -x "$HOME/.local/bin/sentinel-terminal" ]; then
  APP_BIN="$HOME/.local/bin/sentinel-terminal"
elif [ -n "$APPIMAGE" ] && [ -x "$APPIMAGE" ]; then
  APP_BIN="$APPIMAGE"
elif [ -x "$(dirname "$0")/sentinel-terminal" ]; then
  APP_BIN="$(dirname "$0")/sentinel-terminal"
else
  APP_BIN=""
fi

target="$1"
if [ -z "$target" ]; then target="."; fi

# Direct pass-through for CLI flags
if [ "$target" = "--help" ] || [ "$target" = "-h" ] || [ "$target" = "--version" ] || [ "$target" = "-v" ]; then
  if [ -n "$APP_BIN" ]; then
    exec "$APP_BIN" "$@"
  fi
fi

if [ "$target" = "--new-tab" ]; then
  if [ -n "$APP_BIN" ]; then
    "$APP_BIN" --new-tab >/dev/null 2>&1 &
    exit 0
  fi
fi

if [ "$target" = "--split" ]; then
  if [ -n "$APP_BIN" ]; then
    "$APP_BIN" --split >/dev/null 2>&1 &
    exit 0
  fi
fi

# If target is a file, open terminal in containing folder
if [ -f "$target" ]; then
  target="$(dirname "$target")"
fi

resolved_path=$(cd "$target" 2>/dev/null && pwd || echo "$target")

if [ -n "$APP_BIN" ]; then
  "$APP_BIN" "$resolved_path" >/dev/null 2>&1 &
  exit 0
fi

# Fallback to desktop URL handler if binary was not found directly
if command -v xdg-open >/dev/null 2>&1; then
  if xdg-open "sentinel://open?path=$resolved_path" 2>/dev/null; then
    exit 0
  fi
fi

echo "sentinel: error: Sentinel Terminal binary ('sentinel-terminal') not found." >&2
echo "Please verify your installation or ensure sentinel-terminal is in PATH." >&2
exit 1
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

        // Also ensure shell wrapper and desktop entry exist
        await this.ensureSentinelShellWrapper(home);
        await this.ensureDesktopEntry(home);
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
target="\${NAUTILUS_SCRIPT_SELECTED_FILE_PATHS:-\${NEMO_SCRIPT_SELECTED_FILE_PATHS:-\${CAJA_SCRIPT_SELECTED_FILE_PATHS:-\$PWD}}}"
target=\$(echo "\$target" | head -n 1)
if [ -z "\$target" ]; then target="\$PWD"; fi
if [ -f "\$target" ]; then target="\$(dirname "\$target")"; fi

if command -v sentinel >/dev/null 2>&1; then
  sentinel "\$target" &
elif [ -x "\$HOME/.local/bin/sentinel" ]; then
  "\$HOME/.local/bin/sentinel" "\$target" &
elif command -v sentinel-terminal >/dev/null 2>&1; then
  sentinel-terminal "\$target" &
elif [ -x "/usr/bin/sentinel-terminal" ]; then
  /usr/bin/sentinel-terminal "\$target" &
fi
`;
        await writeTextFile(scriptPath, scriptContent);
        try {
          await invoke('execute_command', { command: 'chmod', args: ['+x', scriptPath] });
        } catch {}

        // 1. Cinnamon Nemo script
        const nemoDir = joinPath(home, '.local', 'share', 'nemo', 'scripts');
        try {
          if (!(await exists(nemoDir))) await mkdir(nemoDir, { recursive: true });
          await writeTextFile(joinPath(nemoDir, 'Open in Sentinel Terminal'), scriptContent);
          try {
            await invoke('execute_command', { command: 'chmod', args: ['+x', joinPath(nemoDir, 'Open in Sentinel Terminal')] });
          } catch {}
        } catch {}

        // 2. MATE Caja script
        const cajaDir = joinPath(home, '.local', 'share', 'caja', 'scripts');
        try {
          if (!(await exists(cajaDir))) await mkdir(cajaDir, { recursive: true });
          await writeTextFile(joinPath(cajaDir, 'Open in Sentinel Terminal'), scriptContent);
          try {
            await invoke('execute_command', { command: 'chmod', args: ['+x', joinPath(cajaDir, 'Open in Sentinel Terminal')] });
          } catch {}
        } catch {}

        // 3. KDE Dolphin KIO service menus (Plasma 6 & Plasma 5)
        const dolphinMenuContent = `[Desktop Entry]
Type=Service
ServiceTypes=KonqPopupMenu/Plugin,inode/directory
MimeType=inode/directory;
Actions=openInSentinel;
X-KDE-Priority=TopLevel

[Desktop Action openInSentinel]
Name=Open in Sentinel Terminal
Icon=sentinel-terminal
Exec=sentinel "%f"
`;
        const kioDir = joinPath(home, '.local', 'share', 'kio', 'servicemenus');
        try {
          if (!(await exists(kioDir))) await mkdir(kioDir, { recursive: true });
          await writeTextFile(joinPath(kioDir, 'sentinel_open.desktop'), dolphinMenuContent);
        } catch {}

        const kservices5Dir = joinPath(home, '.local', 'share', 'kservices5', 'ServiceMenus');
        try {
          if (!(await exists(kservices5Dir))) await mkdir(kservices5Dir, { recursive: true });
          await writeTextFile(joinPath(kservices5Dir, 'sentinel_open.desktop'), dolphinMenuContent);
        } catch {}

        // 4. XFCE Thunar Custom Actions (uca.xml)
        const thunarDir = joinPath(home, '.config', 'Thunar');
        const ucaPath = joinPath(thunarDir, 'uca.xml');
        try {
          if (!(await exists(thunarDir))) {
            await mkdir(thunarDir, { recursive: true });
          }
          let ucaXml = '';
          if (await exists(ucaPath)) {
            try {
              ucaXml = await readTextFile(ucaPath);
            } catch {
              ucaXml = '';
            }
          }

          if (!ucaXml.includes('sentinel-open-terminal') && !ucaXml.includes('Open in Sentinel Terminal')) {
            const thunarAction = `\n<action>\n\t<icon>sentinel-terminal</icon>\n\t<name>Open in Sentinel Terminal</name>\n\t<submenu></submenu>\n\t<unique-id>sentinel-open-terminal</unique-id>\n\t<command>sentinel %f</command>\n\t<description>Open folder in Sentinel Terminal</description>\n\t<range></range>\n\t<patterns>*</patterns>\n\t<startup-notify/>\n\t<directories/>\n</action>\n`;
            if (ucaXml.includes('</actions>')) {
              ucaXml = ucaXml.replace('</actions>', `${thunarAction}</actions>`);
            } else {
              ucaXml = `<?xml version="1.0" encoding="UTF-8"?>\n<actions>${thunarAction}</actions>\n`;
            }
            await writeTextFile(ucaPath, ucaXml);
          }
        } catch {}

        // 5. FreeDesktop desktop entry
        await this.ensureDesktopEntry(home);

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

      // Also register external terminal launcher
      if (isLinux()) {
        config['terminal.external.linuxExec'] = 'sentinel-terminal';
      }

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

    let binPath = '/Applications/Sentinel Terminal.app/Contents/MacOS/Sentinel Terminal';
    if (isLinux()) {
      if (mockSettingsPath) {
        binPath = joinPath(home, '.local', 'bin', 'sentinel-shell');
      } else {
        const sysWrapper = '/usr/bin/sentinel-shell';
        binPath = (await exists(sysWrapper)) ? sysWrapper : await this.ensureSentinelShellWrapper(home);
      }
    }

    return this.updateIdeSettings(settingsPath, 'Sentinel Shell', binPath);
  }

  /**
   * Configure Cursor IDE integrated terminal profile.
   */
  public async configureCursorIntegration(mockSettingsPath?: string): Promise<{ success: boolean; error?: string }> {
    const home = await this.getResolvedHomeDir();
    const settingsPath = mockSettingsPath || (isLinux()
      ? joinPath(home, '.config', 'Cursor', 'User', 'settings.json')
      : joinPath(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json'));

    let binPath = '/Applications/Sentinel Terminal.app/Contents/MacOS/Sentinel Terminal';
    if (isLinux()) {
      if (mockSettingsPath) {
        binPath = joinPath(home, '.local', 'bin', 'sentinel-shell');
      } else {
        const sysWrapper = '/usr/bin/sentinel-shell';
        binPath = (await exists(sysWrapper)) ? sysWrapper : await this.ensureSentinelShellWrapper(home);
      }
    }

    return this.updateIdeSettings(settingsPath, 'Sentinel Shell', binPath);
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
      || (await exists(joinPath(home, '.local', 'share', 'kio', 'servicemenus', 'sentinel_open.desktop')))
      || (await exists(joinPath(home, '.local', 'share', 'applications', 'sentinel-terminal.desktop')))
      || (await exists(joinPath(home, '.local', 'share', 'applications', 'com.pranav.sentinel-terminal.desktop')));

    const profileKey = isLinux() ? 'terminal.integrated.profiles.linux' : 'terminal.integrated.profiles.osx';

    let vscodeConfigured = false;
    if (await exists(vscodePath)) {
      try {
        const data = JSON.parse(await readTextFile(vscodePath));
        const profiles = data[profileKey] || data['terminal.integrated.profiles.linux'] || data['terminal.integrated.profiles.osx'] || {};
        vscodeConfigured = !!(profiles['Sentinel Shell'] || profiles['Sentinel Terminal']);
      } catch {}
    }

    let cursorConfigured = false;
    if (await exists(cursorPath)) {
      try {
        const data = JSON.parse(await readTextFile(cursorPath));
        const profiles = data[profileKey] || data['terminal.integrated.profiles.linux'] || data['terminal.integrated.profiles.osx'] || {};
        cursorConfigured = !!(profiles['Sentinel Shell'] || profiles['Sentinel Terminal']);
      } catch {}
    }

    let localBinInPath: boolean | undefined = undefined;
    if (isLinux()) {
      localBinInPath = await this.isLocalBinInPath();
    }

    return { cliInstalled, finderEnabled, vscodeConfigured, cursorConfigured, localBinInPath };
  }
}
