/**
 * PromptBuilder.test.ts — Tests for prompt template generation and safety
 */

import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../PromptBuilder';
import type { ConversationMemoryEntry, ConversationGoal, NormalizedGoal } from '../ConversationTypes';

function makeEntry(query: string, goalId: string): ConversationMemoryEntry {
  const [domain, action] = goalId.split('.');
  return {
    query,
    goal: { id: goalId as NormalizedGoal, domain: domain as ConversationGoal['domain'], action, raw: query },
    entities: [],
    timestamp: Date.now(),
  };
}

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  describe('buildGoalExtractionPrompt', () => {
    it('should include the user input', () => {
      const prompt = builder.buildGoalExtractionPrompt('Turn on bluetooth');
      expect(prompt).toContain('Turn on bluetooth');
    });

    it('should include JSON output format', () => {
      const prompt = builder.buildGoalExtractionPrompt('Open Chrome');
      expect(prompt).toContain('"goal"');
      expect(prompt).toContain('"confidence"');
    });

    it('should include example goals', () => {
      const prompt = builder.buildGoalExtractionPrompt('Open Chrome');
      expect(prompt).toContain('bluetooth.enable');
      expect(prompt).toContain('application.open');
    });

    it('should include conversation history when provided', () => {
      const history = [makeEntry('Open Chrome', 'application.open')];
      const prompt = builder.buildGoalExtractionPrompt('Close it', history);
      expect(prompt).toContain('CONVERSATION HISTORY');
      expect(prompt).toContain('Open Chrome');
    });

    it('should pass safety validation', () => {
      const prompt = builder.buildGoalExtractionPrompt('Do something');
      const safety = PromptBuilder.validatePromptSafety(prompt);
      expect(safety.safe).toBe(true);
    });

    it('should explicitly forbid shell commands', () => {
      const prompt = builder.buildGoalExtractionPrompt('Do something');
      expect(prompt.toLowerCase()).toContain('not');
    });
  });

  describe('buildEntityExtractionPrompt', () => {
    it('should include the user input', () => {
      const prompt = builder.buildEntityExtractionPrompt('Kill port 3000');
      expect(prompt).toContain('Kill port 3000');
    });

    it('should list entity types', () => {
      const prompt = builder.buildEntityExtractionPrompt('Test');
      expect(prompt).toContain('application');
      expect(prompt).toContain('port');
      expect(prompt).toContain('bluetooth_device');
    });

    it('should include goal hint when provided', () => {
      const prompt = builder.buildEntityExtractionPrompt('Kill port 3000', 'process.kill_by_port' as NormalizedGoal);
      expect(prompt).toContain('process.kill_by_port');
    });

    it('should pass safety validation', () => {
      const prompt = builder.buildEntityExtractionPrompt('Test');
      const safety = PromptBuilder.validatePromptSafety(prompt);
      expect(safety.safe).toBe(true);
    });
  });

  describe('buildConversationResolutionPrompt', () => {
    it('should include history and input', () => {
      const history = [makeEntry('Open Chrome', 'application.open')];
      const prompt = builder.buildConversationResolutionPrompt('Close it', history);
      expect(prompt).toContain('Close it');
      expect(prompt).toContain('Open Chrome');
    });

    it('should include resolution examples', () => {
      const history = [makeEntry('Open Chrome', 'application.open')];
      const prompt = builder.buildConversationResolutionPrompt('Close it', history);
      expect(prompt).toContain('resolved');
      expect(prompt).toContain('references');
    });

    it('should pass safety validation', () => {
      const history = [makeEntry('Open Chrome', 'application.open')];
      const prompt = builder.buildConversationResolutionPrompt('Close it', history);
      const safety = PromptBuilder.validatePromptSafety(prompt);
      expect(safety.safe).toBe(true);
    });
  });

  describe('validatePromptSafety', () => {
    it('should flag shell command references', () => {
      const result = PromptBuilder.validatePromptSafety('Run a bash script to fix it');
      expect(result.safe).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should flag sudo references', () => {
      const result = PromptBuilder.validatePromptSafety('Use sudo to install');
      expect(result.safe).toBe(false);
    });

    it('should pass clean prompts', () => {
      const result = PromptBuilder.validatePromptSafety('Determine the user goal from natural language');
      expect(result.safe).toBe(true);
    });
  });
});
