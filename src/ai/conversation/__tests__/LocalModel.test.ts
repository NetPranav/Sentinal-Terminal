/**
 * LocalModel.test.ts — Tests for model abstraction layer
 *
 * Uses a mock ModelProvider to test timeout, retry, JSON extraction, and streaming
 * without any network dependency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalModel } from '../LocalModel';
import { ModelManager } from '../../management/ModelManager';
import type { ModelProvider, ProviderResponse, GenerateOptions, ModelMetadata } from '../../provider/Provider';

// ─── Mock Provider ────────────────────────────────────────────────────────────

class MockProvider implements ModelProvider {
  readonly providerId = 'mock';
  readonly providerName = 'Mock Provider';

  public generateFn: (prompt: string, modelId?: string, options?: GenerateOptions) => Promise<ProviderResponse>;

  constructor() {
    this.generateFn = async () => ({
      content: '{"goal": "bluetooth.enable", "confidence": 0.98}',
      raw: {},
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      latencyMs: 50,
    });
  }

  async isAvailable(): Promise<boolean> { return true; }
  async listModels(): Promise<ModelMetadata[]> {
    return [{ id: 'mock-model', name: 'Mock Model', sizeBytes: 0, quantization: 'none' }];
  }
  async hasModel(): Promise<boolean> { return true; }
  async pullModel(): Promise<boolean> { return true; }
  async generate(prompt: string, modelId?: string, options?: GenerateOptions): Promise<ProviderResponse> {
    return this.generateFn(prompt, modelId, options);
  }
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

async function createModel(provider?: MockProvider): Promise<{ model: LocalModel; provider: MockProvider }> {
  const mockProvider = provider || new MockProvider();
  const modelManager = new ModelManager([mockProvider]);
  await modelManager.initialize();
  const model = new LocalModel(modelManager);
  return { model, provider: mockProvider };
}

describe('LocalModel', () => {
  describe('generate', () => {
    it('should return text content from provider', async () => {
      const { model } = await createModel();
      const result = await model.generate('Test prompt');
      expect(result.content).toContain('bluetooth.enable');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.usage.totalTokens).toBe(15);
    });

    it('should retry on failure', async () => {
      const provider = new MockProvider();
      let callCount = 0;
      provider.generateFn = async () => {
        callCount++;
        if (callCount < 3) throw new Error('Transient error');
        return {
          content: '{"result": "ok"}',
          raw: {},
          usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
          latencyMs: 30,
        };
      };

      const { model } = await createModel(provider);
      const result = await model.generate('Retry test', { maxRetries: 3 });
      expect(result.content).toBe('{"result": "ok"}');
      expect(callCount).toBe(3);
    });

    it('should return empty response after all retries exhausted', async () => {
      const provider = new MockProvider();
      provider.generateFn = async () => { throw new Error('Always fails'); };

      const { model } = await createModel(provider);
      const result = await model.generate('Fail test', { maxRetries: 2 });
      expect(result.content).toBe('');
      expect(result.latencyMs).toBe(0);
    });
  });

  describe('generateJSON', () => {
    it('should parse valid JSON', async () => {
      const { model } = await createModel();
      const { data } = await model.generateJSON<{ goal: string }>('Test');
      expect(data).not.toBeNull();
      expect(data?.goal).toBe('bluetooth.enable');
    });

    it('should handle JSON wrapped in markdown fences', async () => {
      const provider = new MockProvider();
      provider.generateFn = async () => ({
        content: '```json\n{"goal": "wifi.enable", "confidence": 0.95}\n```',
        raw: {},
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        latencyMs: 50,
      });

      const { model } = await createModel(provider);
      const { data } = await model.generateJSON<{ goal: string }>('Test');
      expect(data?.goal).toBe('wifi.enable');
    });

    it('should extract JSON from text with surrounding content', async () => {
      const provider = new MockProvider();
      provider.generateFn = async () => ({
        content: 'Here is the result:\n{"goal": "git.clone", "confidence": 0.92}\nDone!',
        raw: {},
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        latencyMs: 50,
      });

      const { model } = await createModel(provider);
      const { data } = await model.generateJSON<{ goal: string }>('Test');
      expect(data?.goal).toBe('git.clone');
    });

    it('should return null for unparseable responses', async () => {
      const provider = new MockProvider();
      provider.generateFn = async () => ({
        content: 'This is not JSON at all',
        raw: {},
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        latencyMs: 50,
      });

      const { model } = await createModel(provider);
      const { data } = await model.generateJSON<{ goal: string }>('Test', { maxRetries: 1 });
      expect(data).toBeNull();
    });

    it('should return null for empty responses', async () => {
      const provider = new MockProvider();
      provider.generateFn = async () => ({
        content: '',
        raw: {},
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 50,
      });

      const { model } = await createModel(provider);
      const { data } = await model.generateJSON<{ goal: string }>('Test', { maxRetries: 1 });
      expect(data).toBeNull();
    });
  });

  describe('generateStream', () => {
    it('should yield content', async () => {
      const { model } = await createModel();
      const chunks: string[] = [];
      for await (const chunk of model.generateStream('Test')) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain('bluetooth.enable');
    });
  });

  describe('isAvailable', () => {
    it('should return true when provider is available', async () => {
      const { model } = await createModel();
      expect(await model.isAvailable()).toBe(true);
    });

    it('should return false when provider throws', async () => {
      const provider = new MockProvider();
      const { model } = await createModel(provider);
      provider.isAvailable = async () => { throw new Error('Down'); };
      expect(await model.isAvailable()).toBe(false);
    });
  });
});

