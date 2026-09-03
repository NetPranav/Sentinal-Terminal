/**
 * Sentinel Terminal — Workspace Registry
 *
 * Scans, indexes, and caches developer workspaces (ROS 1/2, Node, Python, Rust, Docker)
 * across local filesystem roots to provide sub-millisecond workspace navigation.
 */

import { DiscoveredProject, ProjectDiscoveryEngine } from './ProjectDiscoveryEngine';

function joinPath(...parts: string[]): string {
  return parts.map((p, i) => i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

export class WorkspaceRegistry {
  private static instance: WorkspaceRegistry;
  private projects: DiscoveredProject[] = [];
  private isScanning = false;
  private lastScanTime = 0;

  public static getInstance(): WorkspaceRegistry {
    if (!WorkspaceRegistry.instance) {
      WorkspaceRegistry.instance = new WorkspaceRegistry();
    }
    return WorkspaceRegistry.instance;
  }

  /**
   * Returns list of cached projects, triggering a background scan if cache is empty or stale.
   */
  public async getProjects(forceRefresh = false): Promise<DiscoveredProject[]> {
    if (!forceRefresh && this.projects.length > 0 && Date.now() - this.lastScanTime < 300000) {
      return this.projects;
    }
    await this.scan();
    return this.projects;
  }

  public getCachedProjects(): DiscoveredProject[] {
    return this.projects;
  }

  /**
   * Scan primary search roots for developer workspaces
   */
  public async scan(): Promise<DiscoveredProject[]> {
    if (this.isScanning) return this.projects;
    this.isScanning = true;

    try {
      const home = typeof process !== 'undefined' ? (process.env.HOME || process.env.USERPROFILE || '') : '';
      const rootsToScan: string[] = [];

      if (home) {
        rootsToScan.push(joinPath(home, 'Projects'));
        rootsToScan.push(joinPath(home, 'Project Folder'));
        rootsToScan.push(joinPath(home, 'workspace'));
        rootsToScan.push(joinPath(home, 'Developer'));
        rootsToScan.push(joinPath(home, 'src'));
      }

      // Also include current working directory if available
      if (typeof process !== 'undefined' && process.cwd) {
        try {
          const currentCwd = process.cwd();
          if (currentCwd && !rootsToScan.includes(currentCwd)) {
            rootsToScan.push(currentCwd);
          }
        } catch { /* ignore */ }
      }

      const found: DiscoveredProject[] = [];

      for (const root of rootsToScan) {
        try {
          const probeResult = await ProjectDiscoveryEngine.probe('', [root]);
          if (probeResult && probeResult.matches) {
            found.push(...probeResult.matches);
          }
        } catch { /* skip inaccessible root */ }
      }

      // Deduplicate by path
      const unique = new Map<string, DiscoveredProject>();
      for (const p of found) {
        if (!unique.has(p.path)) {
          unique.set(p.path, p);
        }
      }

      this.projects = Array.from(unique.values());
      this.lastScanTime = Date.now();
    } catch (err) {
      console.warn('[WorkspaceRegistry] Scan failed:', err);
    } finally {
      this.isScanning = false;
    }

    return this.projects;
  }
}
