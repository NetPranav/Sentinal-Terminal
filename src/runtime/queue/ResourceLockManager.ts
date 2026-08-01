/**
 * ResourceLockManager.ts — Lightweight resource locking
 *
 * Prevents parallel execution on conflicting resources.
 */

import { ResourceType, ResourceLock, IResourceLockManager } from '../models/RuntimeTypes';

export class ResourceLockManager implements IResourceLockManager {
  private locks: Map<string, ResourceLock> = new Map();

  private key(type: ResourceType, resourceId: string): string {
    return `${type}:${resourceId}`;
  }

  public acquire(type: ResourceType, resourceId: string, nodeId: string): boolean {
    const k = this.key(type, resourceId);
    if (this.locks.has(k)) return false; // Already locked

    this.locks.set(k, {
      type,
      resourceId,
      heldBy: nodeId,
      acquiredAt: Date.now(),
    });
    return true;
  }

  public release(type: ResourceType, resourceId: string, nodeId: string): boolean {
    const k = this.key(type, resourceId);
    const lock = this.locks.get(k);
    if (!lock || lock.heldBy !== nodeId) return false;

    this.locks.delete(k);
    return true;
  }

  public isLocked(type: ResourceType, resourceId: string): boolean {
    return this.locks.has(this.key(type, resourceId));
  }

  public getHolder(type: ResourceType, resourceId: string): string | undefined {
    return this.locks.get(this.key(type, resourceId))?.heldBy;
  }

  public releaseAll(nodeId: string): void {
    for (const [k, lock] of this.locks) {
      if (lock.heldBy === nodeId) {
        this.locks.delete(k);
      }
    }
  }

  public clear(): void {
    this.locks.clear();
  }
}
