/**
 * PluginRegistry.ts — Discovers and tracks loaded plugins
 */

import { PluginHost } from '../host/PluginHost';

export class PluginRegistry {
  private hosts: Map<string, PluginHost> = new Map();

  public register(host: PluginHost): void {
    if (this.hosts.has(host.manifest.id)) {
      throw new Error(`Plugin ${host.manifest.id} is already registered.`);
    }
    this.hosts.set(host.manifest.id, host);
  }

  public getHost(id: string): PluginHost | undefined {
    return this.hosts.get(id);
  }

  public getAllHosts(): PluginHost[] {
    return Array.from(this.hosts.values());
  }

  public remove(id: string): void {
    const host = this.hosts.get(id);
    if (host) {
      if (host.getState() === 'running') {
        host.shutdown();
      }
      this.hosts.delete(id);
    }
  }

  public clear(): void {
    this.getAllHosts().forEach(h => h.shutdown());
    this.hosts.clear();
  }
}

export const globalPluginRegistry = new PluginRegistry();
