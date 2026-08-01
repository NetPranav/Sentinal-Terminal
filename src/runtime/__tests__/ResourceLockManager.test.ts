import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceLockManager } from '../queue/ResourceLockManager';

describe('ResourceLockManager', () => {
  let locks: ResourceLockManager;

  beforeEach(() => {
    locks = new ResourceLockManager();
  });

  it('should acquire and check resource locks', () => {
    expect(locks.acquire('file', '/test.txt', 'node-1')).toBe(true);
    expect(locks.isLocked('file', '/test.txt')).toBe(true);
    expect(locks.getHolder('file', '/test.txt')).toBe('node-1');
  });

  it('should prevent simultaneous locking of the same resource by different nodes', () => {
    locks.acquire('application', 'Safari', 'node-1');
    expect(locks.acquire('application', 'Safari', 'node-2')).toBe(false);
  });

  it('should allow acquiring after release', () => {
    locks.acquire('file', '/doc.md', 'node-1');
    expect(locks.release('file', '/doc.md', 'node-1')).toBe(true);
    expect(locks.isLocked('file', '/doc.md')).toBe(false);

    // Node 2 can now acquire
    expect(locks.acquire('file', '/doc.md', 'node-2')).toBe(true);
  });

  it('should only allow the holding node to release a lock', () => {
    locks.acquire('process', '1234', 'node-1');
    expect(locks.release('process', '1234', 'node-2')).toBe(false);
    expect(locks.isLocked('process', '1234')).toBe(true);
  });

  it('should release all locks held by a specific node upon completion or failure', () => {
    locks.acquire('file', '/f1.txt', 'node-1');
    locks.acquire('file', '/f2.txt', 'node-1');
    locks.acquire('file', '/f3.txt', 'node-2');

    locks.releaseAll('node-1');

    expect(locks.isLocked('file', '/f1.txt')).toBe(false);
    expect(locks.isLocked('file', '/f2.txt')).toBe(false);
    expect(locks.isLocked('file', '/f3.txt')).toBe(true);
  });
});
