/**
 * CapabilityTypes.ts — Complete Interfaces for the Native macOS Capability SDK
 *
 * Defines structured payloads, metadata contracts, and context passthrough.
 * Keeps domain implementations completely decentralized from global orchestration engines.
 */

import { ActionNode } from '../../actions/models/ActionTypes';
import { IExecutionContext } from '../../runtime/models/RuntimeTypes';
import { CancellationToken } from './CancellationToken';

// ─────────────────────────────────────────────────────────────────────────────
// Capability Metadata & Status
// ─────────────────────────────────────────────────────────────────────────────

export type CapabilityHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface CapabilityMetadata {
  /** Unique capability identifier (e.g., 'filesystem', 'browser', 'bluetooth') */
  readonly id: string;
  /** Semantic version of the capability driver */
  readonly version: string;
  /** Human-readable description of the domain capability */
  readonly description: string;
  /** Action ID prefixes or explicit tool IDs supported by this capability (e.g., ['filesystem.', 'app.open']) */
  readonly supportedActions: readonly string[];
  /** Target macOS version or minimum requirement (e.g., '>=12.0') */
  readonly supportedMacOsVersion: string;
  /** OS commands or binaries required (e.g., ['osascript', 'launchctl', 'networksetup']) */
  readonly dependencies: readonly string[];
  /** OS permissions required (e.g., ['Accessibility', 'Full Disk Access']) */
  readonly requiredPermissions: readonly string[];
  /** Current operational health status */
  health: CapabilityHealthStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability Execution Context
// ─────────────────────────────────────────────────────────────────────────────

export interface CapabilityLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

export interface CapabilityContext {
  /** The action node being executed or verified */
  actionNode: ActionNode;
  /** Shared session execution memory for consuming and publishing outputs */
  executionContext: IExecutionContext;
  /** Session identifiers and metadata */
  sessionMetadata: Record<string, unknown>;
  /** Runtime environment details (e.g., host architecture, mock switches) */
  runtimeMetadata: Record<string, unknown>;
  /** Standardized capability logger */
  logger: CapabilityLogger;
  /** Token for checking or registering cooperative cancellation */
  cancellationToken: CancellationToken;
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured Result Payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface CapabilityResult {
  success: boolean;
  outputs: Record<string, unknown>;
  diagnostics?: DiagnosticsReport;
  warnings: string[];
  timings: {
    executionMs: number;
    dispatchMs: number;
  };
  error?: string;
  /** Command or native invocation description for audit logs */
  nativeInvocation?: string;
}

export interface VerificationResult {
  success: boolean;
  /** Structured verified state to be published directly back into ExecutionContext */
  verifiedOutputs: Record<string, unknown>;
  durationMs: number;
  warnings: string[];
  verificationMethod: string;
  error?: string;
}

export interface RollbackResult {
  success: boolean;
  revertedResources: string[];
  failedResources: string[];
  durationMs: number;
  warnings: string[];
  error?: string;
}

export interface DiagnosticsReport {
  healthy: boolean;
  warnings: string[];
  missingDependencies: string[];
  permissionIssues: string[];
  recommendations: string[];
}

export interface PermissionAuditResult {
  permissionId: string;
  granted: boolean;
  status: 'granted' | 'denied' | 'prompt_needed' | 'unknown';
  remedyHint: string;
}

export interface StateCollectorResult<T = unknown> {
  domain: string;
  tier?: 'hot' | 'cold';
  confidence?: number;
  data: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Capability Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ICapability {
  readonly metadata: CapabilityMetadata;
  
  /** Whether the capability is running in simulated mock mode for safe CI testing */
  mockMode: boolean;

  /** Initialize the capability resources and verify dependency binaries */
  initialize(): Promise<void>;

  /** Execute the native macOS task bound to the context's ActionNode */
  execute(ctx: CapabilityContext): Promise<CapabilityResult>;

  /** Verify successful execution postconditions and return verified state outputs */
  verify(ctx: CapabilityContext, execResult: CapabilityResult): Promise<VerificationResult>;

  /** Revert state modifications produced during execution */
  rollback(ctx: CapabilityContext, execResult: CapabilityResult): Promise<RollbackResult>;

  /** Abruptly terminate ongoing actions associated with an action node ID */
  cancel(actionNodeId: string): Promise<void>;

  /** Run subsystem health inspections and return structured diagnostics */
  diagnostics(): Promise<DiagnosticsReport>;

  /** Optional state collector for Phase 6 World Model harvesting (Collector Isolation) */
  collectState?(): Promise<StateCollectorResult<unknown>>;

  /** Clean up resources and terminate background handles */
  shutdown(): Promise<void>;
}
