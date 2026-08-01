/**
 * ActionRuntime.ts — Stub interfaces for Phase 4+
 *
 * Defines the contract for the Execution Runtime.
 * Contains ZERO implementation — execution belongs to the Driver Layer.
 */

import { ActionNode, ActionResult, ActionGraph, ActionExecutor } from '../models/ActionTypes';

// Re-export the core types for convenience
export type { ActionExecutor, ActionResult };

/**
 * Future: Orchestrates the execution of an ActionGraph.
 * Will be implemented in Phase 4 (Execution Runtime).
 */
export interface ActionRuntimeEngine {
  /** Execute an entire action graph, respecting dependencies and parallel groups */
  executeGraph(graph: ActionGraph): Promise<ActionResult[]>;

  /** Execute a single action node */
  executeNode(node: ActionNode): Promise<ActionResult>;

  /** Cancel a running execution */
  cancel(graphId: string): Promise<void>;

  /** Get the status of a running execution */
  getStatus(graphId: string): Promise<ActionRuntimeStatus>;
}

/**
 * Status of a running ActionGraph execution.
 */
export interface ActionRuntimeStatus {
  /** Total nodes in the graph */
  totalNodes: number;
  /** Nodes completed */
  completedNodes: number;
  /** Nodes currently running */
  runningNodes: number;
  /** Nodes that failed */
  failedNodes: number;
  /** Whether the execution is complete */
  isComplete: boolean;
  /** Overall elapsed time in milliseconds */
  elapsedMs: number;
}
