/**
 * ConversationTypes.ts — Strongly Typed Interfaces for the Conversation Engine
 *
 * Every type used across the conversation module is defined here.
 * No `any` types. All output shapes are strictly enforced.
 *
 * This module defines WHAT the user wants — never HOW to do it.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Entity Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exhaustive union of all recognized entity categories.
 * Platform-independent — no OS-specific entity types.
 */
export type EntityType =
  | 'application'
  | 'port'
  | 'file'
  | 'folder'
  | 'path'
  | 'url'
  | 'repository'
  | 'branch'
  | 'ssid'
  | 'bluetooth_device'
  | 'container'
  | 'docker_image'
  | 'package'
  | 'process'
  | 'ip_address'
  | 'email'
  | 'user'
  | 'ssh_host'
  | 'workspace'
  | 'python_env'
  | 'device_name';

/**
 * A single extracted entity with its type, value, raw text, and extraction confidence.
 */
export interface ConversationEntity {
  /** The semantic category of this entity */
  type: EntityType;
  /** The normalized/cleaned value */
  value: string;
  /** Extraction confidence: 0.0 to 1.0 */
  confidence: number;
  /** The raw text span from the user input that produced this entity */
  raw: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical goal domains. Each domain groups related actions.
 */
export type GoalDomain =
  | 'bluetooth'
  | 'wifi'
  | 'filesystem'
  | 'git'
  | 'docker'
  | 'application'
  | 'browser'
  | 'process'
  | 'system'
  | 'package'
  | 'network'
  | 'ssh'
  | 'terminal'
  | 'unknown';

/**
 * A normalized goal identifier in `domain.action` format.
 * Examples: "bluetooth.enable", "application.open", "git.clone"
 */
export type NormalizedGoal = `${GoalDomain}.${string}`;

/**
 * Structured representation of the user's high-level goal.
 */
export interface ConversationGoal {
  /** Canonical goal ID: "domain.action" */
  id: NormalizedGoal;
  /** The domain portion (e.g., "bluetooth", "filesystem") */
  domain: GoalDomain;
  /** The action portion (e.g., "enable", "open", "clone") */
  action: string;
  /** Original user text that produced this goal */
  raw: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambiguity Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Categories of ambiguity detected in user requests.
 */
export type AmbiguityType =
  | 'missing_entity'      // e.g., "open my project" — which project?
  | 'vague_action'        // e.g., "do something with bluetooth"
  | 'multiple_targets'    // e.g., "open Chrome and Firefox" (if unclear which is primary)
  | 'unresolved_reference' // e.g., "close it" with no prior context
  | 'low_confidence';     // model returned very low confidence

/**
 * A single detected ambiguity with a human-readable message and optional suggestions.
 */
export interface Ambiguity {
  /** The category of ambiguity */
  type: AmbiguityType;
  /** Human-readable description of the ambiguity */
  message: string;
  /** Possible resolutions the user could choose from */
  suggestions: string[];
  /** If the ambiguity relates to a missing entity, which type? */
  entityType?: EntityType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Context Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight conversation context for resolving follow-up references.
 * Does NOT store execution results — only semantic understanding state.
 */
export interface ConversationContextState {
  /** Recent entities keyed by type (last N per type) */
  recentEntities: Map<EntityType, ConversationEntity[]>;
  /** Recent goals in order (most recent first) */
  recentGoals: ConversationGoal[];
  /** The currently active subject entity (for "it", "that", etc.) */
  activeSubject: ConversationEntity | null;
  /** Number of turns tracked */
  turnCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single conversation turn stored in memory.
 */
export interface ConversationMemoryEntry {
  /** The original user query */
  query: string;
  /** The extracted goal */
  goal: ConversationGoal;
  /** All extracted entities */
  entities: ConversationEntity[];
  /** Unix timestamp (ms) */
  timestamp: number;
}

/**
 * Serializable snapshot of conversation memory for persistence.
 */
export interface ConversationMemorySnapshot {
  entries: ConversationMemoryEntry[];
  maxSize: number;
  exportedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Local Model Config Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for LLM inference calls.
 */
export interface LocalModelConfig {
  /** Sampling temperature (0.0 = deterministic, 1.0 = creative). Default: 0.1 */
  temperature: number;
  /** Maximum tokens to generate. Default: 1024 */
  maxTokens: number;
  /** Request timeout in milliseconds. Default: 10000 */
  timeoutMs: number;
  /** Number of retries on failure. Default: 3 */
  maxRetries: number;
  /** Whether to enforce JSON output mode. Default: true */
  jsonMode: boolean;
  /** Top-p sampling. Default: 0.9 */
  topP: number;
}

/**
 * Response from the local model wrapper.
 */
export interface LocalModelResponse {
  /** The raw text content returned by the model */
  content: string;
  /** Inference latency in milliseconds */
  latencyMs: number;
  /** Token usage statistics */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Result — THE Primary Output
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The single, strongly-typed output of the entire Conversation Engine.
 *
 * Contains WHAT the user wants (goal), relevant parameters (entities),
 * how confident we are, and any detected ambiguities.
 *
 * Never contains shell commands, workflows, or execution plans.
 */
export interface ConversationResult {
  /** The extracted high-level goal */
  goal: ConversationGoal;
  /** Overall confidence in the extraction: 0.0 to 1.0 */
  confidence: number;
  /** All extracted entities from the request */
  entities: ConversationEntity[];
  /** Current conversation context snapshot */
  context: ConversationContextState;
  /** Detected ambiguities requiring clarification */
  ambiguities: Ambiguity[];
  /** Processing latency in milliseconds */
  latencyMs: number;
  /** Whether this result used the LLM or was resolved purely via heuristics */
  source: 'heuristic' | 'llm' | 'hybrid';
}
