/**
 * IStateCollector.ts — Collector Interface & Schema
 *
 * Enforces collector isolation: every domain capability owns its own state collector.
 * The State Engine aggregates collector outputs without performing centralized OS queries.
 */

import { StateMetadata, CacheTier } from '../models/StateTypes';

export interface DomainStatePayload {
  domain: string;
  tier: CacheTier;
  confidence: number;
  data: unknown;
  source: string;
}

export interface IStateCollector {
  readonly domain: string;
  readonly tier: CacheTier;
  
  /** Harvest current domain state from native capabilities or mock drivers */
  collect(): Promise<DomainStatePayload>;
  
  /** Return whether collector binaries are ready and functional */
  isHealthy(): Promise<boolean>;
}
