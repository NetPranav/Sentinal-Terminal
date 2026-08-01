import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionManager, PermissionError } from '../permissions/PermissionManager';

describe('PermissionManager — Granular Access Control', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
  });

  it('should grant and assert permissions successfully', () => {
    pm.grantPermissions('p1', ['filesystem.read', 'network.http']);
    expect(pm.hasPermission('p1', 'filesystem.read')).toBe(true);
    expect(() => pm.assertPermission('p1', 'filesystem.read')).not.toThrow();
  });

  it('should throw on unauthorized access', () => {
    pm.grantPermissions('p1', ['filesystem.read']);
    expect(pm.hasPermission('p1', 'filesystem.write')).toBe(false);
    expect(() => pm.assertPermission('p1', 'filesystem.write')).toThrowError(PermissionError);
  });

  it('should cleanly revoke all permissions', () => {
    pm.grantPermissions('p1', ['filesystem.read']);
    pm.revokeAll('p1');
    expect(pm.hasPermission('p1', 'filesystem.read')).toBe(false);
  });
});
