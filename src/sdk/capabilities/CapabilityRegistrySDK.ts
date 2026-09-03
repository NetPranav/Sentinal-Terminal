/**
 * CapabilityRegistrySDK.ts — Central Capability SDK Binding Registry
 * 
 * Binds every Tool Registry capability entry directly to its concrete TypeScript execution driver across all 10 priority domains (~91 capabilities).
 * Ensures no shipped tool remains metadata-only.
 * 
 * "The Tool Registry defines WHAT exists.
 *  The Capability SDK defines HOW each tool works.
 *  The Execution Engine invokes the capabilities."
 */

import { ICapabilityDriver, CapabilityExecutionResult, ExecutionContext } from './CapabilitySDK';
import { ApplicationCapability } from './drivers/ApplicationCapability';
import { BrowserCapability } from './drivers/BrowserCapability';
import { WifiCapability } from './drivers/WifiCapability';
import { BluetoothCapability } from './drivers/BluetoothCapability';
import { FilesystemSDKCapability } from './drivers/FilesystemSDKCapability';
import { SystemSDKCapability } from './drivers/SystemSDKCapability';
import { ShellSDKCapability } from './drivers/ShellSDKCapability';
import { GitCapability } from './drivers/GitCapability';
import { DockerCapability } from './drivers/DockerCapability';
import { NodeCapability } from './drivers/NodeCapability';
import { PythonCapability } from './drivers/PythonCapability';
import { NetworkingCapability } from './drivers/NetworkingCapability';
import { DeveloperCapability } from './drivers/DeveloperCapability';

// Avoid a static `node:module` import: Vite must be able to bundle this class
// for the Tauri webview, while the CLI still needs synchronous filesystem access.
const nodeRequire = typeof process !== 'undefined'
  ? (process as any).getBuiltinModule?.('node:module')?.createRequire(import.meta.url) ?? null
  : null;

export class CapabilityRegistrySDK {
  private static instance: CapabilityRegistrySDK;
  private drivers: Map<string, ICapabilityDriver<any, any>> = new Map();
  private fallbackChains: Map<string, ICapabilityDriver<any, any>[]> = new Map();

  private constructor() {
    this.initializeDefaultMappings();
  }

  public static getInstance(): CapabilityRegistrySDK {
    if (!CapabilityRegistrySDK.instance) {
      CapabilityRegistrySDK.instance = new CapabilityRegistrySDK();
    }
    return CapabilityRegistrySDK.instance;
  }

  private initializeDefaultMappings(): void {
    const toolIds: string[] = [];

    if (typeof (import.meta as any).glob === 'function') {
      const toolModules = (import.meta as any).glob('../../../tools/**/tool.json', { eager: true });
      for (const module of Object.values(toolModules)) {
        const toolDef: any = (module as any).default || module;
        if (toolDef?.id) toolIds.push(toolDef.id);
      }
    } else if (nodeRequire) {
      // Node.js CLI runtime fallback
      try {
        const fs = nodeRequire('node:fs');
        const path = nodeRequire('node:path');
        const rootDir = process.cwd();
        const toolsDir = path.resolve(rootDir, 'tools');

        if (fs.existsSync(toolsDir)) {
          const findToolJsons = (dir: string): string[] => {
            let results: string[] = [];
            const list = fs.readdirSync(dir, { withFileTypes: true });
            for (const dirent of list) {
              if (dirent.isDirectory()) {
                const full = path.join(dir, dirent.name);
                const toolJson = path.join(full, 'tool.json');
                if (fs.existsSync(toolJson)) {
                  results.push(toolJson);
                } else {
                  results = results.concat(findToolJsons(full));
                }
              }
            }
            return results;
          };

          const files = findToolJsons(toolsDir);
          for (const f of files) {
            try {
              const def = JSON.parse(fs.readFileSync(f, 'utf-8'));
              if (def?.id) toolIds.push(def.id);
            } catch {}
          }
        }
      } catch (e) {
        console.warn('[CapabilityRegistrySDK] Node.js directory scan error:', e);
      }
    }

    for (const toolId of toolIds) {

      if (toolId.startsWith('filesystem.')) {
        this.register(toolId, new FilesystemSDKCapability(toolId));
      } else if (toolId.startsWith('application.')) {
        this.register(toolId, new ApplicationCapability(toolId));
      } else if (toolId.startsWith('browser.')) {
        this.register(toolId, new BrowserCapability(toolId));
      } else if (toolId.startsWith('git.')) {
        this.register(toolId, new GitCapability(toolId));
      } else if (toolId.startsWith('docker.')) {
        this.register(toolId, new DockerCapability(toolId));
      } else if (toolId.startsWith('node.')) {
        this.register(toolId, new NodeCapability(toolId));
      } else if (toolId.startsWith('python.')) {
        this.register(toolId, new PythonCapability(toolId));
      } else if (toolId.startsWith('network.wifi')) {
        this.register(toolId, new WifiCapability(toolId));
      } else if (toolId.startsWith('network.bluetooth')) {
        this.register(toolId, new BluetoothCapability(toolId));
      } else if (toolId.startsWith('network.')) {
        this.register(toolId, new NetworkingCapability(toolId));
      } else if (toolId.startsWith('system.')) {
        this.register(toolId, new SystemSDKCapability(toolId));
      } else if (toolId.startsWith('developer.')) {
        this.register(toolId, new DeveloperCapability(toolId));
      } else if (toolId === 'shell.execute') {
        this.register(toolId, new ShellSDKCapability());
      } else {
        // Fallback default driver registration
        this.register(toolId, new ShellSDKCapability());
      }
    }

    // 2. Register legacy short ID aliases for network capabilities
    this.register('wifi.scan', new WifiCapability('network.wifi.scan'));
    this.register('wifi.connect', new WifiCapability('network.wifi.connect'));
    this.register('wifi.on', new WifiCapability('network.wifi.on'));
    this.register('wifi.off', new WifiCapability('network.wifi.off'));
    this.register('bluetooth.list', new BluetoothCapability('network.bluetooth.list'));
    this.register('bluetooth.on', new BluetoothCapability('network.bluetooth.on'));
    this.register('bluetooth.off', new BluetoothCapability('network.bluetooth.off'));
    this.register('bluetooth.connect', new BluetoothCapability('network.bluetooth.connect'));
    this.register('application.open', new ApplicationCapability('application.open'));
  }

  public register(toolId: string, driver: ICapabilityDriver<any, any>): void {
    this.drivers.set(toolId, driver);
  }

  /**
   * Register a primary driver with a chain of fallback drivers.
   * If the primary fails, each fallback is tried in order.
   */
  public registerWithFallback(toolId: string, drivers: ICapabilityDriver<any, any>[]): void {
    if (drivers.length === 0) return;
    this.drivers.set(toolId, drivers[0]);
    if (drivers.length > 1) {
      this.fallbackChains.set(toolId, drivers.slice(1));
    }
  }

  public getDriver<I = any, O = any>(toolId: string): ICapabilityDriver<I, O> | undefined {
    return this.drivers.get(toolId) as ICapabilityDriver<I, O> | undefined;
  }

  /**
   * Get the full driver chain (primary + fallbacks) for a tool.
   */
  public getDriverChain<I = any, O = any>(toolId: string): ICapabilityDriver<I, O>[] {
    const primary = this.drivers.get(toolId);
    if (!primary) return [];
    const fallbacks = this.fallbackChains.get(toolId) || [];
    return [primary, ...fallbacks] as ICapabilityDriver<I, O>[];
  }

  public getAllRegisteredIds(): string[] {
    return Array.from(this.drivers.keys());
  }

  public async executeTool<I = any, O = any>(
    toolId: string,
    input: I,
    context?: ExecutionContext
  ): Promise<CapabilityExecutionResult<O>> {
    const chain = this.getDriverChain<I, O>(toolId);
    if (chain.length === 0) {
      return {
        success: false,
        error: {
          code: 'DRIVER_NOT_FOUND',
          message: `No concrete Capability SDK driver found mapped to Tool Registry ID: "${toolId}"`
        }
      };
    }

    // Try primary driver first, then fallbacks in order
    let lastError: any = null;
    for (let i = 0; i < chain.length; i++) {
      try {
        const result = await chain[i].execute(input, context);
        if (result.success) return result;
        lastError = result.error;
        if (i < chain.length - 1) {
          console.warn(`[CapabilitySDK] Driver ${i} for "${toolId}" failed, trying fallback ${i + 1}...`);
        }
      } catch (err: any) {
        lastError = { code: 'DRIVER_ERROR', message: err.message };
        if (i < chain.length - 1) {
          console.warn(`[CapabilitySDK] Driver ${i} for "${toolId}" threw error, trying fallback ${i + 1}...`);
        }
      }
    }

    return {
      success: false,
      error: lastError || { code: 'ALL_DRIVERS_FAILED', message: `All ${chain.length} drivers for "${toolId}" failed.` }
    };
  }
}
