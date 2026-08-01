/**
 * PluginLifecycle.ts — Orchestrates the Plugin State Machine
 */

import { PluginManifest } from '../models/PluginTypes';
import { ManifestValidator } from '../manifest/ManifestValidator';
import { DependencyResolver } from '../dependencies/DependencyResolver';
import { PluginHost } from '../host/PluginHost';
import { PluginRegistry } from '../registry/PluginRegistry';
import { PermissionManager } from '../permissions/PermissionManager';
import { ExtensionPoints } from '../hooks/ExtensionPoints';
import { PluginTelemetry } from '../telemetry/PluginTelemetry';

export interface PluginRawSource {
  readonly manifestRaw: any;
  readonly code: string;
}

export class PluginLifecycle {
  constructor(
    private registry: PluginRegistry,
    private dependencyResolver: DependencyResolver,
    private permissionManager: PermissionManager,
    private extensionPoints: ExtensionPoints,
    private telemetry: PluginTelemetry
  ) {}

  /**
   * Complete end-to-end load of multiple plugins.
   * Discovers -> Validates -> Resolves -> Inits -> Executes
   */
  public async loadPlugins(sources: PluginRawSource[]): Promise<void> {
    const start = performance.now();
    const manifests: PluginManifest[] = [];
    const sourceMap = new Map<string, string>();

    // 1. Discover & Validate
    for (const src of sources) {
      try {
        const manifest = ManifestValidator.validate(src.manifestRaw);
        manifests.push(manifest);
        sourceMap.set(manifest.id, src.code);
      } catch (e) {
        console.error('Plugin validation failed:', e);
      }
    }

    // 2. Resolve Dependencies (Topological Sort)
    let orderedManifests: PluginManifest[] = [];
    try {
      orderedManifests = this.dependencyResolver.resolveOrder(manifests);
    } catch (e) {
      console.error('Dependency resolution failed:', e);
      throw e;
    }

    // 3. Initialize & Enable in Order
    for (const manifest of orderedManifests) {
      const pStart = performance.now();
      const host = new PluginHost(manifest, this.permissionManager, this.extensionPoints);
      
      try {
        await host.initialize(); // Move to 'enable'
        this.registry.register(host);
        
        // 4. Running - execute the JS payload
        const code = sourceMap.get(manifest.id)!;
        await host.executeEntrypoint(code);
        
        this.telemetry.recordLoadTime(manifest.id, performance.now() - pStart);
      } catch (e) {
        this.telemetry.recordCrash(manifest.id);
        console.error(`Lifecycle: Plugin ${manifest.id} failed to load`, e);
      }
    }

    console.log(`PluginLifecycle: Loaded ${orderedManifests.length} plugins in ${performance.now() - start}ms`);
  }

  /**
   * Safely unloads a single plugin without breaking others (assuming they don't depend on it).
   * Note: In a real system we'd verify reverse-dependencies before allowing unload.
   */
  public unloadPlugin(pluginId: string): void {
    this.registry.remove(pluginId);
  }
}
