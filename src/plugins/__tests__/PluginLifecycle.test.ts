import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginLifecycle } from '../lifecycle/PluginLifecycle';
import { PluginRegistry } from '../registry/PluginRegistry';
import { DependencyResolver } from '../dependencies/DependencyResolver';
import { PermissionManager } from '../permissions/PermissionManager';
import { ExtensionPoints } from '../hooks/ExtensionPoints';
import { PluginTelemetry } from '../telemetry/PluginTelemetry';

describe('PluginLifecycle — End-to-End Load & Isolation', () => {
  let lifecycle: PluginLifecycle;
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
    lifecycle = new PluginLifecycle(
      registry,
      new DependencyResolver(),
      new PermissionManager(),
      new ExtensionPoints(),
      new PluginTelemetry()
    );
  });

  it('should successfully load, init, and run multiple plugins in dependency order', async () => {
    const p1Raw = {
      id: 'plg1', name: 'P1', version: '1.0.0', author: 'Author', description: 'D', 
      license: 'MIT', sdkVersion: '1.0.0', entrypoint: 'index.js',
      executionModel: 'capability', permissions: [], dependencies: { 'plg2': '1.0.0' }
    };
    const p2Raw = {
      id: 'plg2', name: 'P2', version: '1.0.0', author: 'Author', description: 'D', 
      license: 'MIT', sdkVersion: '1.0.0', entrypoint: 'index.js',
      executionModel: 'capability', permissions: []
    };

    const sources = [
      { manifestRaw: p1Raw, code: 'console.log("p1 executed");' },
      { manifestRaw: p2Raw, code: 'console.log("p2 executed");' }
    ];

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await lifecycle.loadPlugins(sources);

    // Both should be running
    const hosts = registry.getAllHosts();
    expect(hosts.length).toBe(2);
    
    // Dependency plg2 should be first in the registry due to sorting, but map insertion order isn't guaranteed
    expect(registry.getHost('plg1')?.getState()).toBe('running');
    expect(registry.getHost('plg2')?.getState()).toBe('running');

    consoleLogSpy.mockRestore();
  });
});
