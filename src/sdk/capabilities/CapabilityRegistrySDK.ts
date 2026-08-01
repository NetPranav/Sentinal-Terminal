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

export class CapabilityRegistrySDK {
  private static instance: CapabilityRegistrySDK;
  private drivers: Map<string, ICapabilityDriver<any, any>> = new Map();

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
    const toolModules = import.meta.glob('../../../tools/**/tool.json', { eager: true });
    for (const module of Object.values(toolModules)) {
      const toolDef: any = (module as any).default || module;
      const toolId: string = toolDef.id;
      if (!toolId) continue;

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

  public getDriver<I = any, O = any>(toolId: string): ICapabilityDriver<I, O> | undefined {
    return this.drivers.get(toolId) as ICapabilityDriver<I, O> | undefined;
  }

  public getAllRegisteredIds(): string[] {
    return Array.from(this.drivers.keys());
  }

  public async executeTool<I = any, O = any>(
    toolId: string,
    input: I,
    context?: ExecutionContext
  ): Promise<CapabilityExecutionResult<O>> {
    const driver = this.getDriver<I, O>(toolId);
    if (!driver) {
      return {
        success: false,
        error: {
          code: 'DRIVER_NOT_FOUND',
          message: `No concrete Capability SDK driver found mapped to Tool Registry ID: "${toolId}"`
        }
      };
    }
    return driver.execute(input, context);
  }
}
