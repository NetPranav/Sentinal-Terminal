/**
 * RuntimeTypes.ts — Complete Type System for the Execution Runtime
 *
 * Defines every interface used by the orchestration engine.
 * Contains ZERO execution logic or OS interaction.
 */

import { ActionNode, ActionGraph, ActionResult } from '../../actions/models/ActionTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Node Lifecycle States
// ─────────────────────────────────────────────────────────────────────────────

export type NodeState =
  | 'created'
  | 'queued'
  | 'waiting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

// ─────────────────────────────────────────────────────────────────────────────
// Execution Events
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionEventType =
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'session_completed'
  | 'session_cancelled'
  | 'session_failed'
  | 'action_queued'
  | 'action_waiting'
  | 'action_started'
  | 'action_completed'
  | 'action_failed'
  | 'action_retried'
  | 'action_cancelled'
  | 'action_timed_out'
  | 'context_updated'
  | 'resource_locked'
  | 'resource_released'
  | 'hook_invoked';

export interface ExecutionEvent {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: ExecutionEventType;
  /** Session this event belongs to */
  sessionId: string;
  /** Related action node ID (if applicable) */
  actionNodeId?: string;
  /** Event timestamp (ms since epoch) */
  timestamp: number;
  /** Arbitrary event data */
  data: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution Context — Shared Session Memory
// ─────────────────────────────────────────────────────────────────────────────

export interface IExecutionContext {
  /** Store an action's output for later consumption */
  setOutput(actionNodeId: string, key: string, value: unknown): void;
  /** Retrieve a previous action's output */
  getOutput(actionNodeId: string, key: string): unknown | undefined;
  /** Get all outputs from a specific action */
  getNodeOutputs(actionNodeId: string): Record<string, unknown>;
  /** Set a temporary variable scoped to the session */
  setVariable(key: string, value: unknown): void;
  /** Get a temporary variable */
  getVariable(key: string): unknown | undefined;
  /** Store a shared entity for the session */
  setEntity(type: string, value: string): void;
  /** Get a shared entity */
  getEntity(type: string): string | undefined;
  /** Export the full context state for serialization */
  export(): ExecutionContextSnapshot;
  /** Restore context from a snapshot */
  restore(snapshot: ExecutionContextSnapshot): void;
}

export interface ExecutionContextSnapshot {
  outputs: Record<string, Record<string, unknown>>;
  variables: Record<string, unknown>;
  entities: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource Locking
// ─────────────────────────────────────────────────────────────────────────────

export type ResourceType = 'file' | 'folder' | 'application' | 'process' | 'device' | 'network';

export interface ResourceLock {
  /** Resource type */
  type: ResourceType;
  /** Resource identifier (path, app name, PID, etc.) */
  resourceId: string;
  /** ID of the ActionNode holding the lock */
  heldBy: string;
  /** When the lock was acquired */
  acquiredAt: number;
}

export interface IResourceLockManager {
  acquire(type: ResourceType, resourceId: string, nodeId: string): boolean;
  release(type: ResourceType, resourceId: string, nodeId: string): boolean;
  isLocked(type: ResourceType, resourceId: string): boolean;
  getHolder(type: ResourceType, resourceId: string): string | undefined;
  releaseAll(nodeId: string): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Progress
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionProgress {
  /** Overall completion percentage (0 to 100) */
  percentage: number;
  /** Total nodes in the session */
  totalNodes: number;
  /** Completed nodes */
  completedNodes: number;
  /** Currently running nodes */
  runningNodes: number;
  /** Failed nodes */
  failedNodes: number;
  /** Cancelled nodes */
  cancelledNodes: number;
  /** Elapsed time in ms */
  elapsedMs: number;
  /** Estimated remaining time in ms */
  estimatedRemainingMs: number;
  /** Current action being executed (if single) */
  currentAction?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Status
// ─────────────────────────────────────────────────────────────────────────────

export type SessionStatus =
  | 'created'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ─────────────────────────────────────────────────────────────────────────────
// Session Snapshot (Serialization)
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionSnapshot {
  sessionId: string;
  status: SessionStatus;
  createdAt: number;
  nodeStates: Record<string, NodeState>;
  context: ExecutionContextSnapshot;
  events: ExecutionEvent[];
  results: ActionResult[];
  exportedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Hooks
// ─────────────────────────────────────────────────────────────────────────────

export type HookType =
  | 'before_session_start'
  | 'after_session_finish'
  | 'before_action_execute'
  | 'after_action_execute'
  | 'before_retry'
  | 'after_retry'
  | 'on_failure'
  | 'on_cancellation';

export type HookCallback = (event: ExecutionEvent) => void | Promise<void>;

// ─────────────────────────────────────────────────────────────────────────────
// Rich Execution Metrics
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionMetrics {
  /** Total session duration in ms */
  totalDurationMs: number;
  /** Time spent idle (waiting for dependencies) */
  idleTimeMs: number;
  /** Time nodes spent in queue before execution */
  queueWaitTimeMs: number;
  /** Time spent actively executing nodes */
  activeExecutionTimeMs: number;
  /** Ratio of parallel utilization (0.0 to 1.0) */
  parallelUtilization: number;
  /** Total retries across all nodes */
  retryCount: number;
  /** Total cancellations */
  cancellationCount: number;
  /** Total timeouts */
  timeoutCount: number;
  /** Time spent resolving dependencies */
  dependencyResolutionTimeMs: number;
  /** Average duration per node in ms */
  averageNodeDurationMs: number;
  /** Total nodes executed */
  nodesExecuted: number;
  /** Nodes executed in parallel */
  nodesParallel: number;
}
