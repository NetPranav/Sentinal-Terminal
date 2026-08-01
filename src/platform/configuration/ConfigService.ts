/**
 * ConfigService.ts — Unified Configuration Manager
 */

export type RuntimeProfile = 'Development' | 'Production' | 'Portable' | 'Recovery' | 'Safe Mode';

export interface SentinelConfig {
  readonly profile: RuntimeProfile;
  readonly maxMemoryGb: number;
  readonly telemetryEnabled: boolean;
  readonly autoUpdate: boolean;
}

const DEFAULT_CONFIG: SentinelConfig = {
  profile: 'Production',
  maxMemoryGb: 4,
  telemetryEnabled: true,
  autoUpdate: true
};

export class ConfigService {
  private config: SentinelConfig;

  constructor(initialConfig: Partial<SentinelConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...initialConfig };
  }

  public getProfile(): RuntimeProfile {
    return this.config.profile;
  }

  public getConfig(): Readonly<SentinelConfig> {
    return Object.freeze({ ...this.config });
  }

  public update(newValues: Partial<SentinelConfig>): void {
    this.config = { ...this.config, ...newValues };
  }
}

export const globalConfigService = new ConfigService();
