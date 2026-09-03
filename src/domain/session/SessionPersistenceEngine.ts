/**
 * Sentinel Terminal — Session Persistence Engine
 *
 * Provides crash-proof workspace state serialization for multi-tab and split-pane
 * layouts. Preserves open tabs, hierarchy of split terminals, working directories (cwd),
 * and restores them smoothly upon application restart.
 */

export interface SerializedTab {
  id: string;
  name: string;
  rootPane: any;
}

export interface SerializedSessionState {
  version: number;
  tabs: SerializedTab[];
  activeTabId: string;
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

  /**
   * Save session state (debounced)
   */
  public saveSession(
    tabs: SerializedTab[],
    activeTabId: string,
    panePaths: Record<string, string>,
    debounceMs = 300
  ): void {
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
          panePaths,
          timestamp: Date.now()
        };

        const storage = this.getStorage();
        if (storage) {
          storage.setItem(SessionPersistenceEngine.STORAGE_KEY, JSON.stringify(state));
        }
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
   * Load saved session state
   */
  public loadSession(): SerializedSessionState | null {
    try {
      const storage = this.getStorage();
      if (!storage) return null;
      const raw = storage.getItem(SessionPersistenceEngine.STORAGE_KEY);
      if (!raw) return null;

      const parsed: SerializedSessionState = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
        return null;
      }

      return {
        version: parsed.version || 1,
        tabs: parsed.tabs.map(tab => ({
          ...tab,
          rootPane: this.sanitizePaneTree(tab.rootPane)
        })),
        activeTabId: parsed.activeTabId || parsed.tabs[0].id,
        panePaths: parsed.panePaths || {},
        timestamp: parsed.timestamp || Date.now()
      };
    } catch (err) {
      console.warn('[SessionPersistence] Failed to restore session state:', err);
      return null;
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
    } catch { /* ignore */ }
  }
}
