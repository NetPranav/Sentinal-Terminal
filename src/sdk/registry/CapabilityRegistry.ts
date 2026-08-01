/**
 * CapabilityRegistry.ts — Automated Discovery & O(1) Capability Lookup Registry
 *
 * Automatically loads built-in domain capabilities, supports future plugin capability extensions,
 * and maintains O(1) matching between structured Actions and concrete execution drivers.
 */

import { ICapability, CapabilityMetadata } from '../capabilities/CapabilityTypes';
import { FilesystemCapability } from '../filesystem/FilesystemCapability';
import { ApplicationCapability } from '../application/ApplicationCapability';
import { BrowserCapability } from '../browser/BrowserCapability';
import { WifiCapability } from '../wifi/WifiCapability';
import { BluetoothCapability } from '../bluetooth/BluetoothCapability';
import { ProcessCapability } from '../process/ProcessCapability';
import { SystemCapability } from '../system/SystemCapability';
import { GitCapability } from '../git/GitCapability';
import { DockerCapability } from '../docker/DockerCapability';
import { NodeCapability } from '../node/NodeCapability';
import { PythonCapability } from '../python/PythonCapability';
import { TerminalCapability } from '../terminal/TerminalCapability';
import { DeveloperCapability } from '../developer/DeveloperCapability';

export class CapabilityRegistry {
  private capabilities: Map<string, ICapability> = new Map();
  /** Fast O(1) routing table mapping action IDs and prefixes to their registered capability driver */
  private routingTable: Map<string, ICapability> = new Map();
  private discovered = false;

  constructor(autoDiscover = true) {
    if (autoDiscover) {
      this.discoverCapabilities();
    }
  }

  /**
   * Automated discovery of all standard domain capabilities.
   * Avoids requiring developers to write boilerplate manual registration when deploying drivers.
   */
  public discoverCapabilities(mockMode = process.env.NODE_ENV === 'test'): void {
    if (this.discovered) return;

    const builtInCapabilities: ICapability[] = [
      new FilesystemCapability(mockMode),
      new ApplicationCapability(mockMode),
      new BrowserCapability(mockMode),
      new WifiCapability(mockMode),
      new BluetoothCapability(mockMode),
      new ProcessCapability(mockMode),
      new SystemCapability(mockMode),
      new GitCapability(mockMode),
      new DockerCapability(mockMode),
      new NodeCapability(mockMode),
      new PythonCapability(mockMode),
      new TerminalCapability(mockMode),
      new DeveloperCapability(mockMode),
    ];

    for (const cap of builtInCapabilities) {
      this.registerCapability(cap);
    }
    this.discovered = true;
  }

  /**
   * Register a new capability (supports third-party runtime plugins without altering runtime interfaces).
   */
  public registerCapability(capability: ICapability): void {
    const id = capability.metadata.id.toLowerCase();
    this.capabilities.set(id, capability);

    // Populate O(1) routing table with supported actions and prefixes
    for (const prefix of capability.metadata.supportedActions) {
      this.routingTable.set(prefix.toLowerCase(), capability);
    }
    // Also register domain id followed by dot as a default prefix fallback
    this.routingTable.set(`${id}.`, capability);
    this.routingTable.set(id, capability);
  }

  /**
   * O(1) capability lookup by Action ID (e.g., 'wifi.connect' or 'app.open')
   */
  public lookup(actionId: string): ICapability | undefined {
    const normalized = actionId.toLowerCase().trim();

    // 1. Check exact match in routing table (O(1))
    let match = this.routingTable.get(normalized);
    if (match) return match;

    // 2. Check prefix match (e.g. 'wifi.' or 'network.wifi.') and memoize into routing table for subsequent O(1) speed
    const parts = normalized.split('.');
    for (let i = parts.length - 1; i >= 0; i--) {
      const prefix = parts.slice(0, i + 1).join('.') + (i < parts.length - 1 ? '.' : '');
      match = this.routingTable.get(prefix);
      if (match) {
        this.routingTable.set(normalized, match); // Cache exact actionId for future O(1) access
        return match;
      }
    }

    // 3. Try top-level domain match (e.g. 'application' for 'application.chrome.open')
    match = this.capabilities.get(parts[0]);
    if (match) {
      this.routingTable.set(normalized, match);
      return match;
    }

    return undefined;
  }

  public getCapabilityById(id: string): ICapability | undefined {
    return this.capabilities.get(id.toLowerCase());
  }

  public getAllCapabilities(): ICapability[] {
    return Array.from(this.capabilities.values());
  }

  public getAllMetadata(): CapabilityMetadata[] {
    return this.getAllCapabilities().map(c => c.metadata);
  }

  public getHealthSummary(): Record<string, string> {
    const summary: Record<string, string> = {};
    for (const [id, cap] of this.capabilities.entries()) {
      summary[id] = cap.metadata.health;
    }
    return summary;
  }

  public clear(): void {
    this.capabilities.clear();
    this.routingTable.clear();
    this.discovered = false;
  }
}

export const globalCapabilityRegistry = new CapabilityRegistry(true);
