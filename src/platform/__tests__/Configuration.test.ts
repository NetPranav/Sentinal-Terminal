import { describe, it, expect } from 'vitest';
import { ConfigService } from '../configuration/ConfigService';
import { FeatureFlagManager } from '../configuration/FeatureFlagManager';
import { Logger, LogLevel } from '../logging/Logger';

describe('Production Platform — Configuration & Logging', () => {
  it('ConfigService should securely bind to environmental profiles', () => {
    const service = new ConfigService({ profile: 'Safe Mode' });
    expect(service.getProfile()).toBe('Safe Mode');
    expect(service.getConfig().maxMemoryGb).toBe(4);
    
    service.update({ maxMemoryGb: 8 });
    expect(service.getConfig().maxMemoryGb).toBe(8);
  });

  it('FeatureFlagManager should support channels without recompilation', () => {
    const flags = new FeatureFlagManager('Beta');
    expect(flags.getChannel()).toBe('Beta');
    
    flags.enableFlag('experimental_ui');
    expect(flags.isEnabled('experimental_ui')).toBe(true);
    expect(flags.isEnabled('unknown_flag')).toBe(false);
  });

  it('Logger should enforce level severity limits', () => {
    const logger = new Logger();
    logger.setLevel(LogLevel.Error);
    
    logger.info('Ignored message');
    logger.error('Kept message');
    
    const history = logger.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].level).toBe(LogLevel.Error);
  });
});
