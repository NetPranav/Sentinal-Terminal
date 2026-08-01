/**
 * ConversationEngine.test.ts — End-to-end tests for the conversation pipeline
 *
 * Tests the full pipeline: input → goal → entities → context → memory → result
 * Uses a mock model provider — no network or Ollama required.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationEngine } from '../ConversationEngine';
import { ModelManager } from '../../management/ModelManager';
import type { ModelProvider, ProviderResponse, ModelMetadata } from '../../provider/Provider';

// ─── Mock Provider ────────────────────────────────────────────────────────────

class MockProvider implements ModelProvider {
  readonly providerId = 'mock';
  readonly providerName = 'Mock Provider';

  async isAvailable(): Promise<boolean> { return true; }
  async listModels(): Promise<ModelMetadata[]> {
    return [{ id: 'mock-model', name: 'Mock', sizeBytes: 0 }];
  }
  async hasModel(): Promise<boolean> { return true; }
  async pullModel(): Promise<boolean> { return true; }
  async generate(): Promise<ProviderResponse> {
    return {
      content: '{"goal": "unknown.unknown", "confidence": 0.3}',
      raw: {},
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      latencyMs: 50,
    };
  }
}

async function createEngine(): Promise<ConversationEngine> {
  const modelManager = new ModelManager([new MockProvider()]);
  await modelManager.initialize();
  return new ConversationEngine(modelManager, { maxHistorySize: 10 });
}

describe('ConversationEngine', () => {
  let engine: ConversationEngine;

  beforeEach(async () => {
    engine = await createEngine();
  });

  // ── Simple Requests ────────────────────────────────────────────────────

  describe('simple requests', () => {
    it('should process "Turn on Bluetooth"', async () => {
      const result = await engine.process('Turn on Bluetooth');
      expect(result.goal.id).toBe('bluetooth.enable');
      expect(result.goal.domain).toBe('bluetooth');
      expect(result.goal.action).toBe('enable');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.source).toBe('heuristic');
      expect(result.ambiguities).toHaveLength(0);
    });

    it('should process "Open Chrome"', async () => {
      const result = await engine.process('Open Chrome');
      expect(result.goal.id).toBe('application.open');
      expect(result.entities.some(e => e.type === 'application' && e.value === 'Chrome')).toBe(true);
    });

    it('should process "git pull"', async () => {
      const result = await engine.process('git pull');
      expect(result.goal.id).toBe('git.pull');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should process "Kill the process on port 3000"', async () => {
      const result = await engine.process('Kill the process on port 3000');
      expect(result.goal.id).toBe('process.kill_by_port');
      expect(result.entities.some(e => e.type === 'port' && e.value === '3000')).toBe(true);
    });

    it('should process "Connect to AirPods"', async () => {
      const result = await engine.process('Connect to my AirPods');
      expect(result.goal.id).toBe('bluetooth.connect');
      expect(result.entities.some(e => e.type === 'bluetooth_device')).toBe(true);
    });
  });

  // ── Multi-Entity Requests ──────────────────────────────────────────────

  describe('multi-entity requests', () => {
    it('should extract multiple entities', async () => {
      const result = await engine.process('Open https://github.com/user/repo in Chrome');
      expect(result.entities.length).toBeGreaterThanOrEqual(2);
      const types = result.entities.map(e => e.type);
      expect(types).toContain('application');
      expect(types).toContain('url');
    });

    it('should handle port and process together', async () => {
      const result = await engine.process('Kill the process on port 8080');
      expect(result.goal.id).toBe('process.kill_by_port');
      expect(result.entities.some(e => e.type === 'port' && e.value === '8080')).toBe(true);
    });
  });

  // ── Pronoun Resolution ─────────────────────────────────────────────────

  describe('pronoun resolution', () => {
    it('should resolve "it" from previous turn', async () => {
      await engine.process('Open Chrome');
      const result = await engine.process('Now close it');
      // "it" should be resolved to "Chrome", so the goal should be application.close
      expect(result.goal.id).toBe('application.close');
    });

    it('should resolve "the app" from previous turn', async () => {
      await engine.process('Open Spotify');
      const result = await engine.process('Quit the app');
      // Should resolve "the app" to Spotify
      expect(result.goal.domain).toBe('application');
    });

    it('should handle chains of context', async () => {
      await engine.process('Turn on Bluetooth');
      await engine.process('Connect to AirPods');
      // Context should track both bluetooth and AirPods
      const context = engine.getContext();
      expect(context.hasContext()).toBe(true);
    });
  });

  // ── Ambiguity Detection ────────────────────────────────────────────────

  describe('ambiguity detection', () => {
    it('should flag empty input', async () => {
      const result = await engine.process('');
      expect(result.ambiguities.length).toBeGreaterThan(0);
      expect(result.confidence).toBe(0);
    });

    it('should flag whitespace-only input', async () => {
      const result = await engine.process('   ');
      expect(result.ambiguities.length).toBeGreaterThan(0);
    });
  });

  // ── Memory ─────────────────────────────────────────────────────────────

  describe('memory', () => {
    it('should store turns in memory', async () => {
      await engine.process('Open Chrome');
      await engine.process('Turn on Bluetooth');

      const memory = engine.getMemory();
      expect(memory.size()).toBe(2);
    });

    it('should track recent goals', async () => {
      await engine.process('Open Chrome');
      await engine.process('Turn on Bluetooth');

      const goals = engine.getMemory().getRecentGoals(2);
      expect(goals[0].id).toBe('bluetooth.enable');
      expect(goals[1].id).toBe('application.open');
    });

    it('should track recent entities', async () => {
      await engine.process('Open Chrome');
      await engine.process('Kill the process on port 3000');

      const entities = engine.getMemory().getRecentEntities();
      expect(entities.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Reset ──────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('should clear all state', async () => {
      await engine.process('Open Chrome');
      await engine.process('Turn on Bluetooth');

      engine.reset();

      expect(engine.getMemory().isEmpty()).toBe(true);
      expect(engine.getContext().hasContext()).toBe(false);
    });
  });

  // ── Result Shape ───────────────────────────────────────────────────────

  describe('result shape', () => {
    it('should always return a valid ConversationResult', async () => {
      const result = await engine.process('Turn on Bluetooth');

      // Check all required fields exist
      expect(result).toHaveProperty('goal');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('context');
      expect(result).toHaveProperty('ambiguities');
      expect(result).toHaveProperty('latencyMs');
      expect(result).toHaveProperty('source');

      // Check types
      expect(typeof result.goal.id).toBe('string');
      expect(typeof result.goal.domain).toBe('string');
      expect(typeof result.goal.action).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.ambiguities)).toBe(true);
      expect(typeof result.latencyMs).toBe('number');
      expect(['heuristic', 'llm', 'hybrid']).toContain(result.source);
    });

    it('should never contain shell commands in goal', async () => {
      const result = await engine.process('Turn on Bluetooth');
      expect(result.goal.id).not.toMatch(/\bsudo\b/);
      expect(result.goal.id).not.toMatch(/\brm\b/);
      expect(result.goal.id).not.toMatch(/\bkill\s+-/);
    });

    it('should report latency', async () => {
      const result = await engine.process('Open Chrome');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      // Heuristic path should be very fast
      expect(result.latencyMs).toBeLessThan(100);
    });
  });

  // ── Performance ────────────────────────────────────────────────────────

  describe('performance', () => {
    it('should process heuristic requests in under 10ms', async () => {
      const start = performance.now();
      await engine.process('Turn on Bluetooth');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
    });
  });
});
