/**
 * GoalExtractor.ts — Two-Tier Goal Extraction
 *
 * Tier 1: Fast heuristic matching (<5ms) via IntentNormalizer.
 * Tier 2: LLM fallback for ambiguous or complex requests.
 *
 * Always produces a ConversationGoal — never a shell command.
 */

import type {
  ConversationGoal,
  ConversationMemoryEntry,
  NormalizedGoal,
  GoalDomain,
  Ambiguity,
} from './ConversationTypes';
import { IntentNormalizer } from './IntentNormalizer';
import { LocalModel } from './LocalModel';
import { PromptBuilder } from './PromptBuilder';
import { ResponseValidator, GoalResponse } from './ResponseValidator';

/**
 * Result from goal extraction, including the goal, confidence,
 * source tier, and any detected ambiguities.
 */
export interface GoalExtractionResult {
  goal: ConversationGoal;
  confidence: number;
  source: 'heuristic' | 'llm';
  ambiguities: Ambiguity[];
}

export class GoalExtractor {
  private normalizer: IntentNormalizer;
  private promptBuilder: PromptBuilder;
  private validator: ResponseValidator;

  constructor(private model: LocalModel) {
    this.normalizer = new IntentNormalizer();
    this.promptBuilder = new PromptBuilder();
    this.validator = new ResponseValidator();
  }

  /**
   * Extract the user's goal from natural language input.
   *
   * 1. Try fast heuristic normalization first.
   * 2. If no match, fall back to LLM.
   * 3. If LLM fails, return unknown goal with ambiguity.
   */
  public async extract(
    input: string,
    history?: ConversationMemoryEntry[]
  ): Promise<GoalExtractionResult> {
    const clean = input.trim();

    if (!clean) {
      return this.createUnknownResult(clean, 'vague_action', 'Empty input');
    }

    // ── Tier 1: Fast Heuristic ──────────────────────────────────────────
    const normalized = this.normalizer.normalize(clean);
    if (normalized.matched && normalized.goal && normalized.domain) {
      const parts = normalized.goal.split('.');
      return {
        goal: {
          id: normalized.goal,
          domain: normalized.domain,
          action: parts.slice(1).join('.'),
          raw: clean,
        },
        confidence: normalized.confidence,
        source: 'heuristic',
        ambiguities: [],
      };
    }

    // ── Tier 2: LLM Fallback ────────────────────────────────────────────
    return this.extractViaLLM(clean, history);
  }

  /**
   * Use the LLM to extract the goal for complex/ambiguous inputs.
   */
  private async extractViaLLM(
    input: string,
    history?: ConversationMemoryEntry[]
  ): Promise<GoalExtractionResult> {
    try {
      const prompt = this.promptBuilder.buildGoalExtractionPrompt(input, history);
      const { data } = await this.model.generateJSON<GoalResponse>(prompt, {
        temperature: 0.1,
        maxTokens: 256,
        timeoutMs: 8000,
      });

      if (!data) {
        return this.createUnknownResult(input, 'low_confidence', 'Model returned no usable response');
      }

      // Validate the response
      const validation = this.validator.validateGoalResponse(data);
      if (!validation.valid || !validation.data) {
        return this.createUnknownResult(input, 'low_confidence', 'Model response failed validation');
      }

      const goalData = validation.data;

      // Check for shell command leakage
      if (this.validator.containsShellCommand(goalData.goal)) {
        return this.createUnknownResult(input, 'low_confidence', 'Model attempted to generate a command');
      }

      // Check confidence threshold
      if (this.validator.isLowConfidence(goalData.confidence)) {
        const ambiguity = this.validator.createLowConfidenceAmbiguity(goalData.confidence, input);
        const goal = this.validator.toConversationGoal(goalData, input);
        return {
          goal,
          confidence: goalData.confidence,
          source: 'llm',
          ambiguities: [ambiguity],
        };
      }

      const goal = this.validator.toConversationGoal(goalData, input);
      return {
        goal,
        confidence: goalData.confidence,
        source: 'llm',
        ambiguities: [],
      };
    } catch (err) {
      console.error('[GoalExtractor] LLM extraction failed:', err);
      return this.createUnknownResult(input, 'low_confidence', 'LLM extraction failed');
    }
  }

  /**
   * Create a fallback unknown result with an ambiguity.
   */
  private createUnknownResult(
    input: string,
    ambiguityType: Ambiguity['type'],
    message: string
  ): GoalExtractionResult {
    return {
      goal: {
        id: 'unknown.unknown' as NormalizedGoal,
        domain: 'unknown' as GoalDomain,
        action: 'unknown',
        raw: input,
      },
      confidence: 0,
      source: 'heuristic',
      ambiguities: [{
        type: ambiguityType,
        message,
        suggestions: ['Please rephrase your request', 'Try being more specific'],
      }],
    };
  }
}
