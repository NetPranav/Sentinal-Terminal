/**
 * Optimizer.ts — Synthesizes Long-Term Preferences for Planner Context
 */

import { PatternDiscoveryEngine } from '../discovery/PatternDiscoveryEngine';

export interface DefaultPreferences {
  preferredIde?: string;
  preferredBrowser?: string;
  preferredRepairStrategy?: string;
  preferredTerminal?: string;
}

export class Optimizer {
  constructor(private discovery: PatternDiscoveryEngine) {}

  /**
   * Synthesizes long-term preferences into a context block that the Planner can consume.
   */
  public synthesizeDefaults(): DefaultPreferences {
    // In a real implementation, we would pass categories to discoverFrequencyPreferences
    // e.g. discoverFrequencyPreferences('application_opened')
    const preferences = this.discovery.discoverFrequencyPreferences();
    const defaults: DefaultPreferences = {};

    for (const pref of preferences) {
      if (pref.confidence > 0.4) {
        // Simple mapping based on entity IDs for demonstration
        if (pref.targetEntityId.toLowerCase().includes('code') || pref.targetEntityId.toLowerCase().includes('cursor')) {
          if (!defaults.preferredIde) defaults.preferredIde = pref.targetEntityId;
        } else if (pref.targetEntityId.toLowerCase().includes('chrome') || pref.targetEntityId.toLowerCase().includes('safari')) {
          if (!defaults.preferredBrowser) defaults.preferredBrowser = pref.targetEntityId;
        } else if (pref.targetEntityId.includes('repair_')) {
          if (!defaults.preferredRepairStrategy) defaults.preferredRepairStrategy = pref.targetEntityId;
        }
      }
    }

    return defaults;
  }
}
