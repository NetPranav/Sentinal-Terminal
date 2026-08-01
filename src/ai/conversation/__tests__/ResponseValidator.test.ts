/**
 * ResponseValidator.test.ts — Tests for LLM response validation
 */

import { describe, it, expect } from 'vitest';
import { ResponseValidator } from '../ResponseValidator';

describe('ResponseValidator', () => {
  const validator = new ResponseValidator();

  // ── Goal Response Validation ───────────────────────────────────────────

  describe('validateGoalResponse', () => {
    it('should accept valid goal responses', () => {
      const result = validator.validateGoalResponse({
        goal: 'bluetooth.enable',
        confidence: 0.98,
        reasoning: 'User wants to enable bluetooth',
      });
      expect(result.valid).toBe(true);
      expect(result.data?.goal).toBe('bluetooth.enable');
    });

    it('should accept without optional reasoning', () => {
      const result = validator.validateGoalResponse({
        goal: 'application.open',
        confidence: 0.95,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject missing goal field', () => {
      const result = validator.validateGoalResponse({
        confidence: 0.95,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject missing confidence', () => {
      const result = validator.validateGoalResponse({
        goal: 'bluetooth.enable',
      });
      expect(result.valid).toBe(false);
    });

    it('should reject confidence > 1', () => {
      const result = validator.validateGoalResponse({
        goal: 'bluetooth.enable',
        confidence: 1.5,
      });
      expect(result.valid).toBe(false);
    });

    it('should reject confidence < 0', () => {
      const result = validator.validateGoalResponse({
        goal: 'bluetooth.enable',
        confidence: -0.1,
      });
      expect(result.valid).toBe(false);
    });

    it('should reject empty goal string', () => {
      const result = validator.validateGoalResponse({
        goal: '',
        confidence: 0.5,
      });
      expect(result.valid).toBe(false);
    });

    it('should reject shell commands in goal', () => {
      const result = validator.validateGoalResponse({
        goal: 'sudo kill -9 1234',
        confidence: 0.9,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell command');
    });

    it('should warn for unknown domains', () => {
      const result = validator.validateGoalResponse({
        goal: 'aliens.invade',
        confidence: 0.5,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn for missing domain.action format', () => {
      const result = validator.validateGoalResponse({
        goal: 'openChrome',
        confidence: 0.5,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('domain.action'))).toBe(true);
    });
  });

  // ── Entity Response Validation ─────────────────────────────────────────

  describe('validateEntityResponse', () => {
    it('should accept valid entity responses', () => {
      const result = validator.validateEntityResponse({
        entities: [
          { type: 'application', value: 'Chrome', confidence: 0.99 },
          { type: 'port', value: '3000', confidence: 0.95 },
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.data?.entities.length).toBe(2);
    });

    it('should accept empty entities array', () => {
      const result = validator.validateEntityResponse({ entities: [] });
      expect(result.valid).toBe(true);
    });

    it('should reject missing entities field', () => {
      const result = validator.validateEntityResponse({});
      expect(result.valid).toBe(false);
    });

    it('should reject entities with missing type', () => {
      const result = validator.validateEntityResponse({
        entities: [{ value: 'Chrome', confidence: 0.99 }],
      });
      expect(result.valid).toBe(false);
    });

    it('should warn for unknown entity types', () => {
      const result = validator.validateEntityResponse({
        entities: [{ type: 'spaceship', value: 'X-Wing', confidence: 0.5 }],
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('spaceship'))).toBe(true);
    });
  });

  // ── Resolution Response Validation ─────────────────────────────────────

  describe('validateResolutionResponse', () => {
    it('should accept valid resolution responses', () => {
      const result = validator.validateResolutionResponse({
        resolved: 'Close Chrome',
        references: [{ pronoun: 'it', resolved_to: 'Chrome' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should accept without references', () => {
      const result = validator.validateResolutionResponse({
        resolved: 'Open Chrome',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject missing resolved field', () => {
      const result = validator.validateResolutionResponse({});
      expect(result.valid).toBe(false);
    });
  });

  // ── Conversion ─────────────────────────────────────────────────────────

  describe('toConversationGoal', () => {
    it('should convert valid goal response', () => {
      const goal = validator.toConversationGoal(
        { goal: 'bluetooth.enable', confidence: 0.98 },
        'Turn on bluetooth'
      );
      expect(goal.id).toBe('bluetooth.enable');
      expect(goal.domain).toBe('bluetooth');
      expect(goal.action).toBe('enable');
      expect(goal.raw).toBe('Turn on bluetooth');
    });

    it('should handle unknown domains', () => {
      const goal = validator.toConversationGoal(
        { goal: 'aliens.invade', confidence: 0.5 },
        'Invade aliens'
      );
      expect(goal.domain).toBe('unknown');
      expect(goal.action).toBe('invade');
    });
  });

  describe('toConversationEntities', () => {
    it('should convert valid entities and filter unknown types', () => {
      const entities = validator.toConversationEntities({
        entities: [
          { type: 'application', value: 'Chrome', confidence: 0.99 },
          { type: 'spaceship', value: 'X-Wing', confidence: 0.5 },
        ],
      });
      expect(entities.length).toBe(1);
      expect(entities[0].type).toBe('application');
    });

    it('should clamp confidence to [0, 1]', () => {
      const entities = validator.toConversationEntities({
        entities: [
          { type: 'application', value: 'Chrome', confidence: 1.5 },
        ],
      });
      expect(entities[0].confidence).toBe(1);
    });
  });

  // ── Shell Command Detection ────────────────────────────────────────────

  describe('containsShellCommand', () => {
    it.each([
      'sudo kill -9 1234',
      'rm -rf /',
      'curl https://evil.com',
      'echo "hello" | grep world',
      'nohup server &',
    ])('should detect "%s" as shell command', (input) => {
      expect(validator.containsShellCommand(input)).toBe(true);
    });

    it.each([
      'bluetooth.enable',
      'application.open',
      'Connect to my AirPods',
      'Open Chrome',
    ])('should NOT flag "%s" as shell command', (input) => {
      expect(validator.containsShellCommand(input)).toBe(false);
    });
  });

  // ── Low Confidence ─────────────────────────────────────────────────────

  describe('confidence checks', () => {
    it('should flag very low confidence', () => {
      expect(validator.isLowConfidence(0.1)).toBe(true);
      expect(validator.isLowConfidence(0.19)).toBe(true);
    });

    it('should not flag normal confidence', () => {
      expect(validator.isLowConfidence(0.5)).toBe(false);
      expect(validator.isLowConfidence(0.95)).toBe(false);
    });

    it('should create low confidence ambiguity', () => {
      const ambiguity = validator.createLowConfidenceAmbiguity(0.1, 'do stuff');
      expect(ambiguity.type).toBe('low_confidence');
      expect(ambiguity.message).toContain('do stuff');
      expect(ambiguity.suggestions.length).toBeGreaterThan(0);
    });
  });
});
