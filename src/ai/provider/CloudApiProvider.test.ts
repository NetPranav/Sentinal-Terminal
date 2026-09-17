import { describe, it, expect, beforeEach } from 'vitest';
import { CloudApiProvider } from './CloudApiProvider';

describe('CloudApiProvider', () => {
  let provider: CloudApiProvider;

  beforeEach(() => {
    provider = CloudApiProvider.getInstance();
  });

  it('should initialize with default configs for all supported cloud providers', () => {
    const configs = provider.getSavedConfigs();
    expect(configs.openai).toBeDefined();
    expect(configs.anthropic).toBeDefined();
    expect(configs.groq).toBeDefined();
    expect(configs.deepseek).toBeDefined();
    expect(configs.openrouter).toBeDefined();
    expect(configs.custom).toBeDefined();
  });

  it('should save and retrieve API key configurations', () => {
    provider.saveConfig({
      serviceId: 'groq',
      apiKey: 'gsk_mock_test_123',
      displayName: 'Groq',
      isActive: true
    });

    const active = provider.getActiveConfig();
    expect(active).toBeDefined();
    expect(active?.serviceId).toBe('groq');
    expect(active?.apiKey).toBe('gsk_mock_test_123');
  });

  it('should report availability based on active API key presence', async () => {
    provider.saveConfig({
      serviceId: 'openai',
      apiKey: 'sk-test-key',
      displayName: 'OpenAI',
      isActive: true
    });

    const isAvail = await provider.isAvailable();
    expect(isAvail).toBe(true);

    provider.saveConfig({
      serviceId: 'openai',
      apiKey: '',
      displayName: 'OpenAI',
      isActive: false
    });

    // Check if other active configs exist, or if none active
    const active = provider.getActiveConfig();
    if (!active) {
      const availNone = await provider.isAvailable();
      expect(availNone).toBe(false);
    }
  });
});
