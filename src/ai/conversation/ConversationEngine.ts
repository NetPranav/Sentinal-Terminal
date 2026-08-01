/**
 * ConversationEngine.ts — The Single Public Entry Point
 *
 * Orchestrates the full conversation understanding pipeline:
 *
 *   User Input
 *       ↓
 *   ConversationContext (check for pronouns / references)
 *       ↓
 *   IntentNormalizer (fast pattern match)
 *       ↓ matched?  ──yes──→ skip LLM
 *       ↓ no
 *   GoalExtractor (heuristic → LLM fallback)
 *       ↓
 *   EntityExtractor (regex)
 *       ↓
 *   Ambiguity Detection
 *       ↓
 *   ConversationMemory (store turn)
 *       ↓
 *   Return ConversationResult
 *
 * This module understands WHAT the user wants.
 * It NEVER decides HOW to do it.
 * It NEVER generates shell commands, workflows, or execution plans.
 */

import type {
  ConversationResult,
  ConversationEntity,
  Ambiguity,
} from './ConversationTypes';
import { ModelManager } from '../management/ModelManager';
import { LocalModel } from './LocalModel';
import { GoalExtractor } from './GoalExtractor';
import { EntityExtractor } from './EntityExtractor';
import { ConversationContext } from './ConversationContext';
import { ConversationMemory } from './ConversationMemory';

/**
 * Configuration for the ConversationEngine.
 */
export interface ConversationEngineConfig {
  /** Maximum conversation history size. Default: 20 */
  maxHistorySize: number;
}

const DEFAULT_ENGINE_CONFIG: ConversationEngineConfig = {
  maxHistorySize: 20,
};

export class ConversationEngine {
  private model: LocalModel;
  private goalExtractor: GoalExtractor;
  private entityExtractor: EntityExtractor;
  private context: ConversationContext;
  private memory: ConversationMemory;

  constructor(
    modelManager: ModelManager,
    config?: Partial<ConversationEngineConfig>
  ) {
    const cfg = { ...DEFAULT_ENGINE_CONFIG, ...config };

    this.model = new LocalModel(modelManager);
    this.goalExtractor = new GoalExtractor(this.model);
    this.entityExtractor = new EntityExtractor();
    this.context = new ConversationContext();
    this.memory = new ConversationMemory(cfg.maxHistorySize);
  }

  /**
   * Process a natural language input and return a structured ConversationResult.
   *
   * This is the ONLY public method that external consumers should call.
   */
  public async process(input: string): Promise<ConversationResult> {
    const startTime = performance.now();
    const rawInput = input.trim();

    if (!rawInput) {
      return this.createEmptyResult(startTime);
    }

    // ── Step 1: Pronoun / Reference Resolution ──────────────────────────
    let resolvedInput = rawInput;
    if (this.context.hasContext() && this.context.containsReferences(rawInput)) {
      const resolutions = this.context.resolveReferences(rawInput);
      if (resolutions.length > 0) {
        resolvedInput = this.context.applyResolutions(rawInput, resolutions);
      }
    }

    // ── Step 2: Goal Extraction (heuristic → LLM) ──────────────────────
    const history = this.memory.getHistory(5);
    const goalResult = await this.goalExtractor.extract(resolvedInput, history);

    // ── Step 3: Entity Extraction (regex) ───────────────────────────────
    const entities = this.entityExtractor.extract(resolvedInput);

    // ── Step 4: Ambiguity Detection ─────────────────────────────────────
    const ambiguities: Ambiguity[] = [...goalResult.ambiguities];
    this.detectAmbiguities(resolvedInput, goalResult.goal.domain, entities, ambiguities);

    // ── Step 5: Update Context & Memory ─────────────────────────────────
    this.context.addTurn(goalResult.goal, entities);
    this.memory.addTurn(rawInput, goalResult.goal, entities);

    // ── Step 6: Build Result ────────────────────────────────────────────
    const latencyMs = performance.now() - startTime;

    return {
      goal: goalResult.goal,
      confidence: goalResult.confidence,
      entities,
      context: this.context.getState(),
      ambiguities,
      latencyMs,
      source: goalResult.source,
    };
  }

  /**
   * Get the conversation memory for inspection.
   */
  public getMemory(): ConversationMemory {
    return this.memory;
  }

  /**
   * Get the conversation context for inspection.
   */
  public getContext(): ConversationContext {
    return this.context;
  }

  /**
   * Reset all conversation state (context + memory).
   */
  public reset(): void {
    this.context.reset();
    this.memory.clear();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Detect additional ambiguities based on the goal domain and entities.
   */
  private detectAmbiguities(
    input: string,
    domain: string,
    entities: ConversationEntity[],
    ambiguities: Ambiguity[]
  ): void {
    // Missing entity detection based on domain expectations
    const domainEntityRequirements: Record<string, { entityType: string; label: string }[]> = {
      'bluetooth': [{ entityType: 'bluetooth_device', label: 'Bluetooth device' }],
      'wifi': [{ entityType: 'ssid', label: 'WiFi network name' }],
      'application': [{ entityType: 'application', label: 'application name' }],
      'git': [{ entityType: 'repository', label: 'repository' }],
      'docker': [{ entityType: 'container', label: 'container name' }],
      'ssh': [{ entityType: 'ssh_host', label: 'SSH host' }],
    };

    const requirements = domainEntityRequirements[domain];
    if (requirements) {
      for (const req of requirements) {
        // Only flag missing entities for actions that definitely need them
        const needsEntity = this.actionNeedsEntity(domain, input);
        if (needsEntity && !entities.some(e => e.type === req.entityType)) {
          // Check if the input itself contains a likely entity name we just didn't extract
          const hasLikelyTarget = this.hasLikelyTargetInInput(input, domain);
          if (!hasLikelyTarget) {
            ambiguities.push({
              type: 'missing_entity',
              message: `Which ${req.label}?`,
              suggestions: [],
              entityType: req.entityType as ConversationEntity['type'],
            });
          }
        }
      }
    }

    // Detect unresolved references with no context
    if (!this.context.hasContext() && this.context.containsReferences(input)) {
      ambiguities.push({
        type: 'unresolved_reference',
        message: 'Could not resolve reference — no previous context available',
        suggestions: ['Please specify what you are referring to'],
      });
    }
  }

  /**
   * Check if the action type typically requires a target entity.
   * Actions like "enable/disable" don't need a specific target,
   * while "connect/open" typically do.
   */
  private actionNeedsEntity(domain: string, input: string): boolean {
    const clean = input.toLowerCase();

    // These actions operate on the domain itself, no specific entity needed
    const noEntityActions = [
      /\b(?:enable|disable|turn\s+on|turn\s+off|activate|deactivate)\b/,
      /\b(?:scan|list|show|status)\b/,
    ];

    for (const pattern of noEntityActions) {
      if (pattern.test(clean)) {
        // For bluetooth/wifi enable/disable, no entity needed
        if (domain === 'bluetooth' || domain === 'wifi') return false;
      }
    }

    // Connect/pair/open typically need a target
    const entityActions = [
      /\b(?:connect|pair|disconnect|unpair)\b/,
      /\b(?:open|close|quit|kill|terminate)\b/,
      /\b(?:clone|pull|push|checkout)\b/,
    ];

    return entityActions.some(pattern => pattern.test(clean));
  }

  /**
   * Heuristic check: does the input contain a likely target name
   * even if our entity extractor didn't formally extract it?
   */
  private hasLikelyTargetInInput(input: string, domain: string): boolean {
    const clean = input.toLowerCase();
    // If input has a quoted string or a capitalized word after the action verb,
    // there's probably a target we just didn't extract.
    if (/["'].+["']/.test(input)) return true;

    // For application domain: any capitalized word after open/close/launch
    if (domain === 'application') {
      if (/\b(?:open|close|launch|start|quit|kill)\s+[A-Z]/.test(input)) return true;
    }

    // For bluetooth: check for device-like words
    if (domain === 'bluetooth') {
      if (/\b(?:my|the)\s+\w+/i.test(clean)) return true;
    }

    return false;
  }

  /**
   * Create an empty result for empty or whitespace-only input.
   */
  private createEmptyResult(startTime: number): ConversationResult {
    return {
      goal: {
        id: 'unknown.unknown' as ConversationResult['goal']['id'],
        domain: 'unknown',
        action: 'unknown',
        raw: '',
      },
      confidence: 0,
      entities: [],
      context: this.context.getState(),
      ambiguities: [{
        type: 'vague_action',
        message: 'No input provided',
        suggestions: ['Please describe what you would like to do'],
      }],
      latencyMs: performance.now() - startTime,
      source: 'heuristic',
    };
  }
}
