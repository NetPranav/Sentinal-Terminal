/**
 * Sentinel Terminal — Session Persistence Engine
 *
 * Provides crash-proof workspace state serialization for multi-tab and split-pane
 * layouts. Preserves open tabs, hierarchy of split terminals, working directories (cwd),
 * and restores them smoothly upon application restart.
 *
 * Storage targets:
 * 1. Synchronous localStorage cache for zero-flicker UI initialization.
 * 2. Asynchronous disk file ~/.sentinel/sessions/last_session.json (and named sessions) for cross-session longevity.
 */

export interface SerializedTab {
  id: string;
  name: string;
  customName?: boolean;
  rootPane: any;
}

export interface SerializedSessionState {
  version: number;
  tabs: SerializedTab[];
  activeTabId: string;
  activePaneId?: string;
  panePaths: Record<string, string>;
  timestamp: number;
}

export class SessionPersistenceEngine {
  private static instance: SessionPersistenceEngine;
  private static STORAGE_KEY = 'sentinel_session_state';
  private saveDebounceTimer: any = null;

  public static getInstance(): SessionPersistenceEngine {
    if (!SessionPersistenceEngine.instance) {
      SessionPersistenceEngine.instance = new SessionPersistenceEngine();
    }
    return SessionPersistenceEngine.instance;
  }

  /**
   * Cleans stale PTY session IDs from a pane tree so that fresh processes
   * spawn at the saved cwd paths upon restore.
   */
  public sanitizePaneTree(node: any): any {
    if (!node) return node;
    if (node.type === 'terminal') {
      return {
        type: 'terminal',
        data: {
          id: node.data?.id || `pane_${Math.random().toString(36).substring(2, 8)}`,
          sessionId: undefined // Reset session ID for fresh PTY spawn
        }
      };
    }
    if (node.type === 'split' && node.data) {
      return {
        type: 'split',
        data: {
          ...node.data,
          pane1: this.sanitizePaneTree(node.data.pane1),
          pane2: this.sanitizePaneTree(node.data.pane2)
        }
      };
    }
    return node;
  }

  private getStorage(): Storage | null {
    if (typeof localStorage !== 'undefined') return localStorage;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
  }

  public getSessionDirPath(): string {
    const home = (typeof process !== 'undefined' && process.env?.HOME)
      ? process.env.HOME
      : '/tmp';
    return `${home}/.sentinel/sessions`;
  }

  /**
   * Save session state to disk at ~/.sentinel/sessions/<filename>
   */
  public async saveSessionToFile(state: SerializedSessionState, filename = 'last_session.json'): Promise<boolean> {
    try {
      const dir = this.getSessionDirPath();
      const filePath = `${dir}/${filename}`;
      const content = JSON.stringify(state, null, 2);

      // Node.js environment (e.g. testing / CLI)
      if (typeof process !== 'undefined' && process.versions?.node) {
        try {
          const fs = await import('node:fs');
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, content, 'utf-8');
          return true;
        } catch { /* fallback */ }
      }

      // Tauri environment
      try {
        const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
        const dirExists = await exists(dir);
        if (!dirExists) {
          await mkdir(dir, { recursive: true });
        }
        await writeTextFile(filePath, content);
        return true;
      } catch { /* ignore if tauri plugin-fs is not loaded in current context */ }

      return false;
    } catch (err) {
      console.warn('[SessionPersistence] Failed to write session to disk:', err);
      return false;
    }
  }

  /**
   * Load session state from disk file
   */
  public async loadSessionFromFile(filename = 'last_session.json'): Promise<SerializedSessionState | null> {
    try {
      const filePath = `${this.getSessionDirPath()}/${filename}`;

      // Node.js environment
      if (typeof process !== 'undefined' && process.versions?.node) {
        try {
          const fs = await import('node:fs');
          if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
              return {
                version: parsed.version || 1,
                tabs: parsed.tabs.map((tab: any) => ({
                  ...tab,
                  rootPane: this.sanitizePaneTree(tab.rootPane)
                })),
                activeTabId: parsed.activeTabId || parsed.tabs[0].id,
                activePaneId: parsed.activePaneId,
                panePaths: parsed.panePaths || {},
                timestamp: parsed.timestamp || Date.now()
              };
            }
          }
        } catch { /* fallback */ }
      }

      // Tauri environment
      try {
        const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
        if (await exists(filePath)) {
          const raw = await readTextFile(filePath);
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
            return {
              version: parsed.version || 1,
              tabs: parsed.tabs.map((tab: any) => ({
                ...tab,
                rootPane: this.sanitizePaneTree(tab.rootPane)
              })),
              activeTabId: parsed.activeTabId || parsed.tabs[0].id,
              activePaneId: parsed.activePaneId,
              panePaths: parsed.panePaths || {},
              timestamp: parsed.timestamp || Date.now()
            };
          }
        }
      } catch { /* ignore */ }

      return null;
    } catch (err) {
      console.warn('[SessionPersistence] Failed to read session from disk:', err);
      return null;
    }
  }

  /**
   * Save session state (debounced) to both localStorage and disk file
   */
  public saveSession(
    tabs: SerializedTab[],
    activeTabId: string,
    panePaths: Record<string, string>,
    activePaneIdOrDebounce?: string | number,
    maybeDebounceMs = 300
  ): void {
    let activePaneId: string | undefined;
    let debounceMs = maybeDebounceMs;

    if (typeof activePaneIdOrDebounce === 'number') {
      debounceMs = activePaneIdOrDebounce;
      activePaneId = undefined;
    } else {
      activePaneId = activePaneIdOrDebounce;
    }

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    const performSave = () => {
      try {
        const sanitizedTabs = tabs.map(tab => ({
          ...tab,
          rootPane: this.sanitizePaneTree(tab.rootPane)
        }));

        const state: SerializedSessionState = {
          version: 1,
          tabs: sanitizedTabs,
          activeTabId,
          activePaneId,
          panePaths,
          timestamp: Date.now()
        };

        const storage = this.getStorage();
        if (storage) {
          storage.setItem(SessionPersistenceEngine.STORAGE_KEY, JSON.stringify(state));
        }

        // Asynchronously persist to disk (~/.sentinel/sessions/last_session.json)
        this.saveSessionToFile(state).catch(() => {});
      } catch (err) {
        console.warn('[SessionPersistence] Failed to serialize session state:', err);
      }
    };

    if (debounceMs <= 0) {
      performSave();
    } else {
      this.saveDebounceTimer = setTimeout(performSave, debounceMs);
    }
  }

  /**
   * Load saved session state (synchronous with localStorage, falls back to disk if node)
   */
  public loadSession(): SerializedSessionState | null {
    try {
      const storage = this.getStorage();
      if (storage) {
        const raw = storage.getItem(SessionPersistenceEngine.STORAGE_KEY);
        if (raw) {
          try {
            const parsed: SerializedSessionState = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
              return {
                version: parsed.version || 1,
                tabs: parsed.tabs.map(tab => ({
                  ...tab,
                  rootPane: this.sanitizePaneTree(tab.rootPane)
                })),
                activeTabId: parsed.activeTabId || parsed.tabs[0].id,
                activePaneId: parsed.activePaneId,
                panePaths: parsed.panePaths || {},
                timestamp: parsed.timestamp || Date.now()
              };
            }
          } catch (parseErr) {
            console.warn('[SessionPersistence] Corrupted session state in storage:', parseErr);
          }
        }
        return null;
      }

      // Synchronous Node.js fallback (only if no storage/localStorage exists)
      if (typeof process !== 'undefined' && process.versions?.node) {
        try {
          const fs = require('node:fs');
          const filePath = `${this.getSessionDirPath()}/last_session.json`;
          if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
              return {
                version: parsed.version || 1,
                tabs: parsed.tabs.map((tab: any) => ({
                  ...tab,
                  rootPane: this.sanitizePaneTree(tab.rootPane)
                })),
                activeTabId: parsed.activeTabId || parsed.tabs[0].id,
                activePaneId: parsed.activePaneId,
                panePaths: parsed.panePaths || {},
                timestamp: parsed.timestamp || Date.now()
              };
            }
          }
        } catch { /* ignore */ }
      }

      return null;
    } catch (err) {
      console.warn('[SessionPersistence] Failed to restore session state:', err);
      return null;
    }
  }

  /**
   * Save a named workspace session (e.g. "backend-dev", "monitoring")
   */
  public async saveNamedSession(
    name: string,
    tabs: SerializedTab[],
    activeTabId: string,
    panePaths: Record<string, string>,
    activePaneId?: string
  ): Promise<boolean> {
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const state: SerializedSessionState = {
      version: 1,
      tabs: tabs.map(tab => ({ ...tab, rootPane: this.sanitizePaneTree(tab.rootPane) })),
      activeTabId,
      activePaneId,
      panePaths,
      timestamp: Date.now()
    };
    return await this.saveSessionToFile(state, `${sanitizedName}.json`);
  }

  /**
   * Load a named workspace session
   */
  public async loadNamedSession(name: string): Promise<SerializedSessionState | null> {
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return await this.loadSessionFromFile(`${sanitizedName}.json`);
  }

  /**
   * List all saved workspace session files
   */
  public async listSavedSessions(): Promise<string[]> {
    try {
      const dir = this.getSessionDirPath();
      if (typeof process !== 'undefined' && process.versions?.node) {
        try {
          const fs = await import('node:fs');
          if (fs.existsSync(dir)) {
            return fs.readdirSync(dir)
              .filter(f => f.endsWith('.json'))
              .map(f => f.replace(/\.json$/, ''));
          }
        } catch { /* fallback */ }
      }

      try {
        const { readDir, exists } = await import('@tauri-apps/plugin-fs');
        if (await exists(dir)) {
          const entries = await readDir(dir);
          return entries
            .filter(e => e.name && e.name.endsWith('.json'))
            .map(e => e.name!.replace(/\.json$/, ''));
        }
      } catch { /* ignore */ }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Clear saved session
   */
  public clearSession(): void {
    try {
      const storage = this.getStorage();
      if (storage) {
        storage.removeItem(SessionPersistenceEngine.STORAGE_KEY);
      }
      if (typeof process !== 'undefined' && process.versions?.node) {
        try {
          const fs = require('node:fs');
          const filePath = `${this.getSessionDirPath()}/last_session.json`;
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }
}
