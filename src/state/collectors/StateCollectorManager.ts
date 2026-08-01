/**
 * StateCollectorManager.ts — Decentralized State Harvesting Aggregator
 *
 * Coordinates state collection across all SDK capability collectors.
 * Enforces strict isolation: every Capability owns its own harvesting logic.
 * The State Engine only aggregates collector outputs without making OS system calls.
 */

import { IStateCollector, DomainStatePayload } from './IStateCollector';
import { ICapability } from '../../sdk/capabilities/CapabilityTypes';
import { globalCapabilityRegistry } from '../../sdk/registry/CapabilityRegistry';

export class CapabilityStateCollector implements IStateCollector {
  readonly domain: string;
  readonly tier: 'hot' | 'cold';
  private capability: ICapability;

  constructor(capability: ICapability, tier: 'hot' | 'cold' = 'hot') {
    this.capability = capability;
    this.domain = capability.metadata.id;
    this.tier = tier;
  }

  public async collect(): Promise<DomainStatePayload> {
    if (this.capability.collectState) {
      const res = await this.capability.collectState();
      return {
        domain: res.domain || this.domain,
        tier: res.tier || this.tier,
        confidence: res.confidence !== undefined ? res.confidence : 1.0,
        data: res.data,
        source: `collector:${this.domain}`,
      };
    }

    // Fallback default state payload if collectState is not implemented on capability
    return {
      domain: this.domain,
      tier: this.tier,
      confidence: 0.9,
      data: { status: this.capability.metadata.health, domain: this.domain, timestamp: Date.now() },
      source: `collector:${this.domain}`,
    };
  }

  public async isHealthy(): Promise<boolean> {
    return this.capability.metadata.health !== 'unhealthy';
  }
}

export class StateCollectorManager {
  private collectors: Map<string, IStateCollector> = new Map();

  constructor(autoRegisterFromSdk = true) {
    if (autoRegisterFromSdk) {
      this.registerSdkCapabilities();
    }
  }

  /**
   * Automatically discovers and binds SDK capabilities from Phase 5 into isolated state collectors.
   */
  public registerSdkCapabilities(): void {
    const caps = globalCapabilityRegistry.getAllCapabilities();
    for (const cap of caps) {
      const tier = ['wifi', 'bluetooth', 'process', 'application', 'battery', 'terminal'].includes(cap.metadata.id) ? 'hot' : 'cold';
      this.registerCollector(new CapabilityStateCollector(cap, tier as 'hot' | 'cold'));
    }
  }

  public registerCollector(collector: IStateCollector): void {
    this.collectors.set(collector.domain.toLowerCase(), collector);
  }

  public getCollector(domain: string): IStateCollector | undefined {
    return this.collectors.get(domain.toLowerCase());
  }

  public getAllCollectors(): IStateCollector[] {
    return Array.from(this.collectors.values());
  }

  /**
   * Harvest state payloads across all registered domain collectors concurrently.
   */
  public async collectAll(tierFilter?: 'hot' | 'cold'): Promise<DomainStatePayload[]> {
    const targets = Array.from(this.collectors.values()).filter(c => !tierFilter || c.tier === tierFilter);
    return Promise.all(targets.map(c => c.collect()));
  }

  /**
   * Harvest state payload from a specific domain collector.
   */
  public async collectDomain(domain: string): Promise<DomainStatePayload | undefined> {
    const col = this.getCollector(domain);
    if (!col) return undefined;
    return col.collect();
  }

  public clear(): void {
    this.collectors.clear();
  }
}

export const globalStateCollectorManager = new StateCollectorManager(true);
