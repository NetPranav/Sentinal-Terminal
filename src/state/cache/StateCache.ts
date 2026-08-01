/**
 * StateCache.ts — Multi-Tier Hot/Cold Cache with Automatic TTL & Event Invalidation
 *
 * Prevents repeated system queries during high-frequency planning and execution loops.
 * Dynamically re-evaluates confidence and freshness timestamps upon retrieval.
 */

import { StateMetadata, CacheEntry, CacheTier, StateFreshness, StateEventType } from '../models/StateTypes';
import { StateEventBus, globalStateEventBus } from '../events/StateEventBus';

export class StateCache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private eventBus: StateEventBus;
  private unsubscribers: Array<() => void> = [];

  private readonly defaultHotTtlMs = 15000;  // 15 seconds for hot, fast-changing state
  private readonly defaultColdTtlMs = 300000; // 5 minutes for cold, slow-changing state

  constructor(eventBus: StateEventBus = globalStateEventBus) {
    this.eventBus = eventBus;
    this.setupEventInvalidationRules();
  }

  /**
   * Binds real-time OS state mutation events to automatic cache key invalidation.
   */
  private setupEventInvalidationRules(): void {
    const rules: Array<{ event: StateEventType; keys: string[] }> = [
      { event: 'ApplicationStarted', keys: ['applications', 'processes', 'windows', 'foregroundApp'] },
      { event: 'ApplicationClosed', keys: ['applications', 'processes', 'windows'] },
      { event: 'WiFiConnected', keys: ['wifi', 'network', 'currentSSID', 'isConnected:wifi'] },
      { event: 'WiFiDisconnected', keys: ['wifi', 'network', 'currentSSID', 'isConnected:wifi'] },
      { event: 'BluetoothConnected', keys: ['bluetooth', 'isConnected:bluetooth'] },
      { event: 'BluetoothDisconnected', keys: ['bluetooth', 'isConnected:bluetooth'] },
      { event: 'FileCreated', keys: ['filesystem', 'isEmpty', 'exists'] },
      { event: 'FolderDeleted', keys: ['filesystem', 'isEmpty', 'exists'] },
      { event: 'PortOpened', keys: ['processes', 'ownsPort'] },
      { event: 'PortClosed', keys: ['processes', 'ownsPort'] },
      { event: 'ContainerStarted', keys: ['docker'] },
      { event: 'ContainerStopped', keys: ['docker'] },
      { event: 'RepositoryChanged', keys: ['git'] },
      { event: 'BatteryChanged', keys: ['battery', 'batteryLevel'] },
    ];

    for (const rule of rules) {
      const unsub = this.eventBus.subscribe(rule.event, () => {
        for (const k of rule.keys) {
          this.invalidatePrefix(k);
        }
      });
      this.unsubscribers.push(unsub);
    }
  }

  /**
   * Put domain state payload into the Hot or Cold tier.
   */
  public set<T>(
    key: string,
    data: T,
    tier: CacheTier = 'hot',
    confidence = 1.0,
    source = 'collector:harvest',
    customTtlMs?: number
  ): StateMetadata<T> {
    const ttlMs = customTtlMs ?? (tier === 'hot' ? this.defaultHotTtlMs : this.defaultColdTtlMs);
    const now = Date.now();

    const metadata: StateMetadata<T> = {
      data,
      timestamp: now,
      confidence,
      source,
      freshness: 'hot',
    };

    const entry: CacheEntry<T> = {
      key,
      tier,
      value: metadata,
      ttlMs,
      expiresAt: now + ttlMs,
    };

    this.store.set(key, entry);
    return metadata;
  }

  /**
   * Retrieve state from cache if present. Dynamically re-evaluates freshness indicator
   * based on elapsed TTL duration.
   */
  public get<T>(key: string): StateMetadata<T> | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    const elapsed = now - entry.value.timestamp;
    const ttl = entry.ttlMs;

    let freshness: StateFreshness = 'hot';
    if (elapsed >= ttl) {
      freshness = 'expired';
    } else if (elapsed >= ttl * 0.75) {
      freshness = 'stale';
    } else if (elapsed >= ttl * 0.25) {
      freshness = 'warm';
    }

    // Return fresh metadata wrapper with re-calculated freshness
    const updatedMeta: StateMetadata<T> = {
      ...entry.value,
      freshness,
    };

    if (freshness === 'expired') {
      return updatedMeta; // Return even if expired so callers can check status, or evict if strict
    }

    return updatedMeta;
  }

  /**
   * Invalidate exact cache key.
   */
  public invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Invalidate all keys matching or starting with a prefix (e.g. 'ownsPort' or 'wifi').
   */
  public invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const k of this.store.keys()) {
      if (k === prefix || k.startsWith(`${prefix}:`) || k.startsWith(`${prefix}.`)) {
        this.store.delete(k);
        count++;
      }
    }
    return count;
  }

  public getStats(): { totalEntries: number; hotEntries: number; coldEntries: number } {
    let hot = 0;
    let cold = 0;
    for (const entry of this.store.values()) {
      if (entry.tier === 'hot') hot++;
      else cold++;
    }
    return { totalEntries: this.store.size, hotEntries: hot, coldEntries: cold };
  }

  public clear(): void {
    this.store.clear();
  }

  public destroy(): void {
    for (const u of this.unsubscribers) u();
    this.unsubscribers = [];
    this.clear();
  }
}

export const globalStateCache = new StateCache(globalStateEventBus);
