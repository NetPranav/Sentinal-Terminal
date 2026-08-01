/**
 * PlannerTypes.ts — Strongly Typed Interfaces for the Goal Planning Engine
 *
 * Defines the logical structures used to plan how a goal is achieved.
 * Emphasizes logical nodes (GoalNodes) rather than executable tasks.
 */

import { ConversationEntity, EntityType, NormalizedGoal } from '../conversation/ConversationTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Planning States & Dependencies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State of a goal node during the planning phase.
 * Allows the planner to halt and request clarification.
 */
export type PlanningState =
  | 'known'        // Node is fully understood and plannable
  | 'unknown'      // Node requires further decomposition or clarification
  | 'satisfied'    // Node is already satisfied by the current system state
  | 'unsatisfied'  // Node needs to be executed
  | 'blocked';     // Node is missing required entities to proceed

/**
 * Represents a dependency edge in the DAG.
 */
export interface TaskDependency {
  /** ID of the node that must complete first */
  nodeId: string;
  /** Whether this dependency is strictly required to proceed */
  required: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal Node
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A platform-independent logical objective.
 * Replaces the concept of an executable "Task".
 */
export interface GoalNode {
  /** Unique identifier for this node (UUID) */
  id: string;
  /** Human-readable title of the objective */
  title: string;
  /** Detailed description of what this objective entails */
  description: string;
  /** The canonical goal ID (e.g. "bluetooth.enable") */
  goal: NormalizedGoal;
  
  // DAG and Hierarchy
  /** Nodes that must be satisfied before this node */
  dependencies: TaskDependency[];
  /** The parent node ID, if this is a sub-objective in a recursive plan */
  parentGoalId?: string;
  /** IDs of child nodes that this objective was decomposed into */
  childGoalIds?: string[];

  // Entities & State
  /** Entities required for this node to be satisfied */
  requiredEntities: EntityType[];
  /** Entities bound to this node (extracted from ConversationResult) */
  boundEntities: ConversationEntity[];
  /** Current state of this node in the plan */
  planningState: PlanningState;
  
  // Metadata & Reasoning
  /** Short reasoning explaining why this node exists */
  reasoning: string;
  /** Confidence in this node being the correct objective (0.0 to 1.0) */
  confidence: number;
  /** Whether this objective is entirely platform independent */
  platformIndependent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution Plan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Information about entities missing from the plan, required to unblock nodes.
 */
export interface MissingEntityInfo {
  /** Type of the entity missing */
  type: EntityType;
  /** Message explaining why it is needed */
  reason: string;
  /** ID of the node that is blocked */
  blockedNodeId: string;
}

/**
 * The final output of the Goal Planning Engine.
 * A structured DAG of GoalNodes, devoid of execution specifics.
 */
export interface ExecutionPlan {
  /** The directed acyclic graph of logical objectives */
  nodes: GoalNode[];
  /** Topologically sorted node IDs for sequential execution paths */
  topologicalOrder: string[];
  /** Nodes that can run in parallel, grouped by execution tier */
  parallelGroups: string[][];
  
  /** Overall confidence of the planner in this plan (0.0 to 1.0) */
  overallConfidence: number;
  /** Entities preventing the plan from being fully known/unsatisfied */
  missingEntities: MissingEntityInfo[];
  
  /** True if the plan is ready for the Execution Engine */
  isComplete: boolean;
  /** Telemetry associated with generating this plan */
  telemetry: PlannerTelemetry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry & State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Telemetry recorded during planning for Phase 13.
 */
export interface PlannerTelemetry {
  /** Time spent reasoning in milliseconds */
  latencyMs: number;
  /** Total number of nodes in the generated plan */
  nodeCount: number;
  /** Maximum depth of recursive decomposition */
  maxDepth: number;
  /** Number of conditional branches evaluated */
  conditionalBranches: number;
  /** Number of parallel branches identified */
  parallelBranches: number;
  /** Number of retries due to reasoning failures or validation errors */
  reasoningRetries: number;
  /** Overall plan confidence */
  confidence: number;
}

/**
 * Placeholder for Phase 4 (State Engine).
 * Allows the planner to check if goals are already satisfied.
 */
export interface CurrentSystemState {
  // To be expanded in Phase 4
  getState(key: string): any;
  hasEntity(type: EntityType, value: string): boolean;
}
