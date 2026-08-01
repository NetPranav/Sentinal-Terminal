import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginHost } from '../host/PluginHost';
import { PluginManifest } from '../models/PluginTypes';
import { PermissionManager } from '../permissions/PermissionManager';
import { ExtensionPoints } from '../hooks/ExtensionPoints';

describe('PluginHost — Sandbox Wrap & Crash Recovery', () => {
  let host: PluginHost;
  let pm: PermissionManager;
  let ep: ExtensionPoints;

  const manifest: PluginManifest = {
    id: 'test.crash', name: 'Test', version: '1.0.0', author: 'Author',
    description: 'D', license: 'MIT', sdkVersion: '1.0.0', entrypoint: 'index.js',
    executionModel: 'capability', permissions: ['filesystem.read']
  };

  beforeEach(() => {
    pm = new PermissionManager();
    ep = new ExtensionPoints();
    host = new PluginHost(manifest, pm, ep);
  });

  it('should initialize and grant permissions', async () => {
    expect(host.getState()).toBe('load');
    await host.initialize();
    expect(host.getState()).toBe('enable');
    expect(pm.hasPermission(manifest.id, 'filesystem.read')).toBe(true);
  });

  it('should catch panics inside the sandbox without crashing core', async () => {
    await host.initialize();
    
    // Attempt to execute a script that intentionally throws
    const badCode = `throw new Error('Plugin Panic!');`;
    
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await expect(host.executeEntrypoint(badCode)).resolves.not.toThrow();
    expect(host.getState()).toBe('error');
    
    consoleErrorSpy.mockRestore();
  });

  it('should revoke permissions on shutdown', async () => {
    await host.initialize();
    host.shutdown();
    expect(host.getState()).toBe('unload');
    expect(pm.hasPermission(manifest.id, 'filesystem.read')).toBe(false);
  });
});
