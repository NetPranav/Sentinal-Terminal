/**
 * AppAliasRegistry.ts — Persistent Application Registry & Alias Resolution
 * 
 * Manages native OS desktop application naming mappings and aliases.
 * Solves common macOS naming discrepancies (e.g., "chrome" -> "Google Chrome")
 * and enables runtime user customization via the /app or /alias slash command.
 */

import { invoke } from '@tauri-apps/api/core';

export class AppAliasRegistry {
  private static instance?: AppAliasRegistry;
  private aliases: Map<string, string> = new Map();

  private defaultAliases: Record<string, string> = {
    'chrome': 'Google Chrome',
    'google chrome': 'Google Chrome',
    'googlechrome': 'Google Chrome',
    'vscode': 'Visual Studio Code',
    'code': 'Visual Studio Code',
    'vs code': 'Visual Studio Code',
    'word': 'Microsoft Word',
    'excel': 'Microsoft Excel',
    'powerpoint': 'Microsoft PowerPoint',
    'edge': 'Microsoft Edge',
    'microsoft edge': 'Microsoft Edge',
    'firefox': 'Firefox',
    'brave': 'Brave Browser',
    'sublime': 'Sublime Text',
    'pycharm': 'PyCharm',
    'intellij': 'IntelliJ IDEA',
    'webstorm': 'WebStorm',
    'spotify': 'Spotify',
    'discord': 'Discord',
    'slack': 'Slack',
    'zoom': 'Zoom',
    'messages': 'Messages',
    'notes': 'Notes',
    'mail': 'Mail',
    'calendar': 'Calendar',
    'calculator': 'Calculator',
    'safari': 'Safari',
    'terminal': 'Terminal',
    'sentinel': 'Sentinel Terminal',
    'sentinel terminal': 'Sentinel Terminal',
    'antigravity': 'Antigravity IDE',
    'antigravity ide': 'Antigravity IDE',
    'cursor': 'Cursor',
    'cursor ai': 'Cursor',
    'finder': 'Finder'
  };

  private constructor() {
    this.resetToDefaults();
    this.initStorage();
  }

  public static getInstance(): AppAliasRegistry {
    if (!AppAliasRegistry.instance) {
      AppAliasRegistry.instance = new AppAliasRegistry();
    }
    return AppAliasRegistry.instance;
  }

  private resetToDefaults(): void {
    this.aliases.clear();
    for (const [alias, actual] of Object.entries(this.defaultAliases)) {
      this.aliases.set(alias.toLowerCase().trim(), actual);
    }
  }

  private initStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('sentinel_app_aliases');
        if (saved) {
          const custom = JSON.parse(saved);
          for (const [key, val] of Object.entries(custom)) {
            this.aliases.set(key.toLowerCase().trim(), String(val));
          }
        }
      } catch (e) {
        console.warn('[AppAliasRegistry] Could not read from localStorage:', e);
      }
    }

    // Try reading from ~/.sentinel/app_aliases.json asynchronously via Tauri in desktop mode
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      invoke<{ stdout: string }>('execute_command', { command: 'sh', args: ['-c', 'cat "$HOME/.sentinel/app_aliases.json" 2>/dev/null || true'] })
        .then(res => {
          if (res?.stdout) {
            const parsed = JSON.parse(res.stdout);
            for (const [key, val] of Object.entries(parsed)) {
              this.aliases.set(key.toLowerCase().trim(), String(val));
            }
          }
        })
        .catch(() => { /* Ignore in environments without native backend */ });
    }
  }

  private saveState(): void {
    const data: Record<string, string> = {};
    for (const [k, v] of this.aliases.entries()) {
      data[k] = v;
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sentinel_app_aliases', JSON.stringify(data));
      } catch (e) {
        console.warn('[AppAliasRegistry] Failed saving to localStorage:', e);
      }
    }

    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      try {
        const jsonStr = JSON.stringify(data).replace(/'/g, "'\\''");
        const cmd = `mkdir -p "$HOME/.sentinel" && echo '${jsonStr}' > "$HOME/.sentinel/app_aliases.json"`;
        invoke('execute_command', { command: 'sh', args: ['-c', cmd] }).catch(() => { /* ignore */ });
      } catch { /* ignore */ }
    }
  }

  /**
   * Resolve an application name or alias to its actual native system desktop application name.
   */
  public resolve(appNameOrAlias: string): string {
    if (!appNameOrAlias) return '';
    const clean = appNameOrAlias.trim().replace(/^(?:the|my|a|an)\s+/i, '');
    const lower = clean.toLowerCase();

    // Check direct alias lookup
    if (this.aliases.has(lower)) {
      return this.aliases.get(lower)!;
    }

    // Check if stripping .app suffix matches
    const noApp = lower.replace(/\.app$/i, '').trim();
    if (this.aliases.has(noApp)) {
      return this.aliases.get(noApp)!;
    }

    // Otherwise return original trimmed name
    return clean;
  }

  /**
   * Set or update an application alias mapping and save to storage.
   */
  public setAlias(alias: string, actualAppName: string): void {
    if (!alias || !actualAppName) return;
    this.aliases.set(alias.toLowerCase().trim(), actualAppName.trim());
    this.saveState();
  }

  /**
   * Remove a custom alias from the registry.
   */
  public removeAlias(alias: string): boolean {
    const res = this.aliases.delete(alias.toLowerCase().trim());
    if (res) this.saveState();
    return res;
  }

  /**
   * Get all currently registered application aliases.
   */
  public getAll(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.aliases.entries()) {
      out[k] = v;
    }
    return out;
  }

  /**
   * For test resetting
   */
  public reset(): void {
    this.resetToDefaults();
  }
}
