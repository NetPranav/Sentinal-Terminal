/**
 * ResponseValidator.ts — LLM Response Validation & Recovery
 *
 * Validates every LLM response before the Conversation Engine returns it.
 * Uses Zod for schema validation. Handles:
 * - Malformed JSON
 * - Missing required fields
 * - Invalid confidence ranges
 * - Shell command leakage detection
 * - Extremely low confidence → ambiguity conversion
 *
 * Never crashes. Always returns a usable result or a clear error.
 */

import { z } from 'zod';
import type {
  ConversationGoal,
  ConversationEntity,
  NormalizedGoal,
  GoalDomain,
  EntityType,
  Ambiguity,
} from './ConversationTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas
// ─────────────────────────────────────────────────────────────────────────────

const VALID_DOMAINS: GoalDomain[] = [
  'bluetooth', 'wifi', 'filesystem', 'git', 'docker',
  'application', 'browser', 'process', 'system', 'package',
  'network', 'ssh', 'terminal', 'unknown',
];

const VALID_ENTITY_TYPES: EntityType[] = [
  'application', 'port', 'file', 'folder', 'path', 'url',
  'repository', 'branch', 'ssid', 'bluetooth_device', 'container',
  'docker_image', 'package', 'process', 'ip_address', 'email',
  'user', 'ssh_host', 'workspace', 'python_env', 'device_name',
];

/** Schema for goal extraction LLM responses */
const GoalResponseSchema = z.object({
  goal: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

/** Schema for entity extraction LLM responses */
const EntityResponseSchema = z.object({
  entities: z.array(z.object({
    type: z.string().min(1),
    value: z.string().min(1),
    confidence: z.number().min(0).max(1),
  })),
});

/** Schema for conversation resolution LLM responses */
const ResolutionResponseSchema = z.object({
  resolved: z.string().min(1),
  references: z.array(z.object({
    pronoun: z.string(),
    resolved_to: z.string(),
  })).optional(),
});

export type GoalResponse = z.infer<typeof GoalResponseSchema>;
export type EntityResponse = z.infer<typeof EntityResponseSchema>;
export type ResolutionResponse = z.infer<typeof ResolutionResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Shell Command Detection
// ─────────────────────────────────────────────────────────────────────────────

const SHELL_COMMAND_PATTERNS = [
  /^(?:sudo|chmod|chown|mv|cp|rm|mkdir|rmdir|cat|echo|grep|awk|sed|curl|wget)\s/i,
  /\|\s*(?:grep|awk|sed|sort|uniq|head|tail|wc)\b/i,
  /^\s*(?:apt|yum|dnf|pacman|brew)\s+(?:install|remove|update|upgrade)\b/i,
  /\bkill\s+-\d+\b/i,
  /\bsudo\s+/i,
  /\bnohup\b/i,
  /\b&&\s*\b/,
  /\b\|\|\s*\b/,
  />\s*\/dev\/null/i,
  /\b2>&1\b/,
];

// ─────────────────────────────────────────────────────────────────────────────
// Validator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validation result with parsed data or structured errors.
 */
export interface ValidationResult<T> {
  valid: boolean;
  data: T | null;
  errors: string[];
  warnings: string[];
}

export class ResponseValidator {
  /** Minimum confidence threshold — below this, result becomes ambiguity */
  private readonly LOW_CONFIDENCE_THRESHOLD = 0.2;

  /**
   * Validate a goal extraction response from the LLM.
   */
  public validateGoalResponse(raw: unknown): ValidationResult<GoalResponse> {
    const result = GoalResponseSchema.safeParse(raw);
    if (!result.success) {
      return {
        valid: false,
        data: null,
        errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        warnings: [],
      };
    }

    const data = result.data;
    const warnings: string[] = [];

    // Check for shell command leakage in the goal field
    if (this.containsShellCommand(data.goal)) {
      return {
        valid: false,
        data: null,
        errors: ['Goal contains shell command — this is not allowed'],
        warnings: [],
      };
    }

    // Validate domain.action format
    if (!data.goal.includes('.')) {
      warnings.push('Goal does not follow domain.action format');
    } else {
      const [domain] = data.goal.split('.');
      if (!VALID_DOMAINS.includes(domain as GoalDomain)) {
        warnings.push(`Unknown domain: "${domain}"`);
      }
    }

    return { valid: true, data, errors: [], warnings };
  }

  /**
   * Validate an entity extraction response from the LLM.
   */
  public validateEntityResponse(raw: unknown): ValidationResult<EntityResponse> {
    const result = EntityResponseSchema.safeParse(raw);
    if (!result.success) {
      return {
        valid: false,
        data: null,
        errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        warnings: [],
      };
    }

    const data = result.data;
    const warnings: string[] = [];

    // Validate individual entity types
    for (const entity of data.entities) {
      if (!VALID_ENTITY_TYPES.includes(entity.type as EntityType)) {
        warnings.push(`Unknown entity type: "${entity.type}"`);
      }
    }

    return { valid: true, data, errors: [], warnings };
  }

  /**
   * Validate a conversation resolution response from the LLM.
   */
  public validateResolutionResponse(raw: unknown): ValidationResult<ResolutionResponse> {
    const result = ResolutionResponseSchema.safeParse(raw);
    if (!result.success) {
      return {
        valid: false,
        data: null,
        errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        warnings: [],
      };
    }

    return { valid: true, data: result.data, errors: [], warnings: [] };
  }

  /**
   * Convert a validated goal response into a ConversationGoal.
   */
  public toConversationGoal(response: GoalResponse, rawInput: string): ConversationGoal {
    const parts = response.goal.split('.');
    const domain = (VALID_DOMAINS.includes(parts[0] as GoalDomain) ? parts[0] : 'unknown') as GoalDomain;
    const action = parts.slice(1).join('.') || 'unknown';

    return {
      id: `${domain}.${action}` as NormalizedGoal,
      domain,
      action,
      raw: rawInput,
    };
  }

  /**
   * Convert validated entity responses into ConversationEntity[].
   */
  public toConversationEntities(response: EntityResponse): ConversationEntity[] {
    return response.entities
      .filter(e => VALID_ENTITY_TYPES.includes(e.type as EntityType))
      .map(e => ({
        type: e.type as EntityType,
        value: e.value,
        confidence: Math.max(0, Math.min(1, e.confidence)),
        raw: e.value,
      }));
  }

  /**
   * Check if a confidence value is too low and should be flagged as ambiguous.
   */
  public isLowConfidence(confidence: number): boolean {
    return confidence < this.LOW_CONFIDENCE_THRESHOLD;
  }

  /**
   * Create a low-confidence ambiguity from a goal response.
   */
  public createLowConfidenceAmbiguity(confidence: number, rawInput: string): Ambiguity {
    return {
      type: 'low_confidence',
      message: `Could not confidently understand the request: "${rawInput}" (confidence: ${(confidence * 100).toFixed(0)}%)`,
      suggestions: ['Please rephrase your request', 'Try being more specific'],
    };
  }

  /**
   * Detect if a string contains shell command patterns.
   */
  public containsShellCommand(text: string): boolean {
    return SHELL_COMMAND_PATTERNS.some(pattern => pattern.test(text));
  }
}
