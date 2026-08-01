/**
 * IDebugProvider.ts — Interface implemented by all core subsystems to expose read-only state.
 */

import { Metric, SubsystemType } from '../models/DevToolsTypes';

export interface IDebugProvider<TSnapshot = unknown, TConfig = unknown> {
  readonly subsystemName: SubsystemType;
  
  /**
   * Returns a deeply cloned, immutable snapshot of the subsystem's current live state.
   */
  getSnapshot(): Readonly<TSnapshot>;
  
  /**
   * Exposes latency, throughput, and error metrics tracked natively by the subsystem.
   */
  getMetrics(): Metric[];
  
  /**
   * Exposes current configuration and bounds for the subsystem.
   */
  getConfiguration(): Readonly<TConfig>;
}
