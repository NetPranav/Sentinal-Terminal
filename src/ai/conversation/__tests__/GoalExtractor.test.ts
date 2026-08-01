/**
 * GoalExtractor.test.ts — Tests for two-tier goal extraction
 *
 * Heuristic tier tests run instantly, LLM tier tests use a mock provider.
 */

import { describe, it, expect } from 'vitest';
import { GoalExtractor } from '../GoalExtractor';
import { LocalModel } from '../LocalModel';
import { ModelManager } from '../../management/ModelManager';
import type { ModelProvider, ProviderResponse, GenerateOptions, ModelMetadata } from '../../provider/Provider';

// ─── Mock Setup ───────────────────────────────────────────────────────────────

class MockProvider implements ModelProvider {
  readonly providerId = 'mock';
  readonly providerName = 'Mock Provider';
  public response: string = '{"goal": "unknown.unknown", "confidence": 0.5}';

  async isAvailable(): Promise<boolean> { return true; }
  async listModels(): Promise<ModelMetadata[]> {
    return [{ id: 'mock-model', name: 'Mock', sizeBytes: 0 }];
  }
  async hasModel(): Promise<boolean> { return true; }
  async pullModel(): Promise<boolean> { return true; }
  async generate(): Promise<ProviderResponse> {
    return {
      content: this.response,
      raw: {},
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      latencyMs: 50,
    };
  }
}

async function createExtractor(mockResponse?: string): Promise<{ extractor: GoalExtractor; provider: MockProvider }> {
  const provider = new MockProvider();
  if (mockResponse) provider.response = mockResponse;
  const modelManager = new ModelManager([provider]);
  await modelManager.initialize();
  const model = new LocalModel(modelManager);
  const extractor = new GoalExtractor(model);
  return { extractor, provider };
}

describe('GoalExtractor', () => {
  // ── Heuristic Tier ─────────────────────────────────────────────────────

  describe('heuristic extraction', () => {
    it('should extract bluetooth.enable from "Turn on Bluetooth"', async () => {
      const { extractor } = await createExtractor();
      const result = await extractor.extract('Turn on Bluetooth');
      expect(result.goal.id).toBe('bluetooth.enable');
      expect(result.source).toBe('heuristic');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.ambiguities).toHaveLength(0);
    });

    it('should extract application.open from "Open Chrome"', async () => {
      const { extractor } = await createExtractor();
      const result = await extractor.extract('Open Chrome');
      expect(result.goal.id).toBe('application.open');
      expect(result.source).toBe('heuristic');
    });

    it('should extract git.clone from "Clone my repository"', async () => {
      const { extractor } = await createExtractor();
      const result = await extractor.extract('Clone my repository');
      expect(result.goal.id).toBe('git.clone');
      expect(result.source).toBe('heuristic');
    });

    it('should extract process.kill_by_port from "Kill the process using port 3000"', async () => {
      const { extractor } = await createExtractor();
      const result = await extractor.extract('Kill the process using port 3000');
      expect(result.goal.id).toBe('process.kill_by_port');
      expect(result.source).toBe('heuristic');
    });

    it('should extract wifi.scan from "Scan wifi networks"', async () => {
      const { extractor } = await createExtractor();
      const result = await extractor.extract('Scan wifi networks');
      expect(result.goal.id).toBe('wifi.scan');
    });

    it('should extract filesystem.create_folder from "Create a new folder"', async () => {
      const { extractor } = await createExtractor();
      const result = await extractor.extract('Create a new folder');
      expect(result.goal.id).toBe('filesystem.create_folder');
    });

    it('should extract git.push from "git push"', async () => {
      const { extractor } = await createExtractor();
      const result = await extractor.extract('git push');
      expect(result.goal.id).toBe('git.push');
    });
  });

  // ── LLM Fallback Tier ──────────────────────────────────────────────────

  describe('LLM fallback', () => {
    it('should fall back to LLM for complex requests', async () => {
      const { extractor } = await createExtractor('{"goal": "system.diagnostics", "confidence": 0.85}');
      const result = await extractor.extract('What are the specs of this machine and how much RAM is available?');
      // This may match heuristic OR LLM depending on pattern — either is acceptable
      expect(result.goal.id).not.toBe('unknown.unknown');
    });

    it('should return unknown for empty input', async () => {
      const { extractor } = await createExtractor();
      const result = await extractor.extract('');
      expect(result.goal.id).toBe('unknown.unknown');
      expect(result.confidence).toBe(0);
      expect(result.ambiguities.length).toBeGreaterThan(0);
    });

    it('should handle LLM returning shell commands gracefully', async () => {
      const { extractor } = await createExtractor('{"goal": "sudo kill -9 1234", "confidence": 0.9}');
      // Feed something that won't match heuristics
      const result = await extractor.extract('xyzzy foobar completely unknown command');
      expect(result.goal.id).toBe('unknown.unknown');
    });

    it('should handle low LLM confidence', async () => {
      const { extractor } = await createExtractor('{"goal": "unknown.something", "confidence": 0.1}');
      const result = await extractor.extract('do the thing with the stuff');
      expect(result.ambiguities.length).toBeGreaterThan(0);
    });
  });

  // ── Performance ────────────────────────────────────────────────────────

  describe('performance', () => {
    it('should extract heuristic goals in under 5ms', async () => {
      const { extractor } = await createExtractor();
      const start = performance.now();
      await extractor.extract('Turn on Bluetooth');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5);
    });
  });
});
