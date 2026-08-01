/**
 * PermissionManager.ts — Evaluates Capability-level permissions
 */

export class PermissionError extends Error {
  constructor(pluginId: string, permission: string) {
    super(`Plugin ${pluginId} was denied access to permission: ${permission}`);
    this.name = 'PermissionError';
  }
}

export class PermissionManager {
  // pluginId -> Set of granted permissions
  private grants: Map<string, Set<string>> = new Map();

  public grantPermissions(pluginId: string, permissions: string[]): void {
    if (!this.grants.has(pluginId)) {
      this.grants.set(pluginId, new Set());
    }
    const set = this.grants.get(pluginId)!;
    permissions.forEach(p => set.add(p));
  }

  public revokeAll(pluginId: string): void {
    this.grants.delete(pluginId);
  }

  public hasPermission(pluginId: string, permission: string): boolean {
    const set = this.grants.get(pluginId);
    if (!set) return false;
    
    // Exact match or wildcard suffix logic could be added here
    return set.has(permission);
  }

  public assertPermission(pluginId: string, permission: string): void {
    if (!this.hasPermission(pluginId, permission)) {
      throw new PermissionError(pluginId, permission);
    }
  }
}
