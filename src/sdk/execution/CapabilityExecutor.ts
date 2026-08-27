/**
 * CapabilityExecutor.ts — High-Performance Execution Bridge (<2ms dispatch)
 *
 * Connects the Phase 4 Execution Runtime to the Native macOS Capability SDK.
 * Implements ActionExecutor, consumes ActionNode inputs directly (zero NLP parsing),
 * performs O(1) driver lookup, checks permissions, executes, verifies, and registers rollback.
 */

import { ActionNode, ActionResult, ActionExecutor } from '../../actions/models/ActionTypes';
import { IExecutionContext } from '../../runtime/models/RuntimeTypes';
import { CapabilityRegistry, globalCapabilityRegistry } from '../registry/CapabilityRegistry';
import { VerificationEngine } from '../verification/VerificationEngine';
import { RollbackEngine } from '../rollback/RollbackEngine';
import { PermissionManager } from '../permissions/PermissionManager';
import { CapabilityContext, CapabilityLogger, VerificationResult, RollbackResult, DiagnosticsReport } from '../capabilities/CapabilityTypes';
import { CancellationToken } from '../capabilities/CancellationToken';

import { getPlatform } from '../../shared/platform';

/** Extended structure returned by CapabilityExecutor providing deep capability insights */
export interface SDKActionResult extends ActionResult {
  verification?: VerificationResult;
  rollbackRegistered: boolean;
  diagnostics?: DiagnosticsReport;
  warnings: string[];
  timings: {
    dispatchMs: number;
    executionMs: number;
    verificationMs: number;
  };
}

class DefaultLogger implements CapabilityLogger {
  debug(m: string, d?: unknown) { if (process.env.DEBUG_SDK) console.debug(`[SDK DEBUG] ${m}`, d || ''); }
  info(m: string, d?: unknown) { if (process.env.DEBUG_SDK) console.info(`[SDK INFO] ${m}`, d || ''); }
  warn(m: string, d?: unknown) { if (process.env.DEBUG_SDK) console.warn(`[SDK WARN] ${m}`, d || ''); }
  error(m: string, e?: unknown) { if (process.env.DEBUG_SDK) console.error(`[SDK ERROR] ${m}`, e || ''); }
}

class MinimalExecutionContext implements IExecutionContext {
  private store: Map<string, unknown> = new Map();
  getOutput(actionNodeId: string, key: string): unknown { return this.store.get(`${actionNodeId}.${key}`); }
  setOutput(actionNodeId: string, key: string, value: unknown): void { this.store.set(`${actionNodeId}.${key}`, value); }
  getVariable(key: string): unknown { return this.store.get(`var.${key}`); }
  setVariable(key: string, value: unknown): void { this.store.set(`var.${key}`, value); }
  getNodeOutputs(actionNodeId: string): Record<string, unknown> { return {}; }
  setEntity(key: string, entity: any): void {}
  getEntity(key: string): any { return null; }
  export(): any { return { outputs: {}, variables: {}, entities: [] }; }
  restore(state: any): void {}
}

export class CapabilityExecutor implements ActionExecutor {
  private logger: CapabilityLogger;
  private defaultContext: IExecutionContext;
  private verificationEngine: VerificationEngine;
  public readonly rollbackEngine: RollbackEngine;
  private permissionManager: PermissionManager;
  private registry: CapabilityRegistry;

  constructor(
    registry: CapabilityRegistry = globalCapabilityRegistry,
    rollbackEngine: RollbackEngine = new RollbackEngine(),
    verificationEngine: VerificationEngine = new VerificationEngine(),
    permissionManager: PermissionManager = new PermissionManager(),
    logger: CapabilityLogger = new DefaultLogger()
  ) {
    this.registry = registry;
    this.rollbackEngine = rollbackEngine;
    this.verificationEngine = verificationEngine;
    this.permissionManager = permissionManager;
    this.logger = logger;
    this.defaultContext = new MinimalExecutionContext();
  }

  /**
   * Execute a single ActionNode via native macOS Capabilities.
   * Parameter Binding: directly consumes node.inputs without intent reasoning or parsing.
   */
  public async execute(
    node: ActionNode,
    executionContext?: IExecutionContext,
    sessionId = 'default_sdk_session'
  ): Promise<SDKActionResult> {
    const startDispatch = performance.now();

    // 1. O(1) lookup of target capability
    const capability = this.registry.lookup(node.action.id);
    const dispatchMs = performance.now() - startDispatch;

    if (!capability) {
      this.logger.error(`No capability registered for action [${node.action.id}]`);
      return {
        actionNodeId: node.id,
        success: false,
        outputs: {},
        error: `No native macOS capability driver found supporting action ID: ${node.action.id}`,
        latencyMs: dispatchMs,
        rollbackRegistered: false,
        warnings: [],
        timings: { dispatchMs, executionMs: 0, verificationMs: 0 },
      };
    }

    // 2. Build unified CapabilityContext
    const ctx: CapabilityContext = {
      actionNode: node,
      executionContext: executionContext || this.defaultContext,
      sessionMetadata: { sessionId },
      runtimeMetadata: { hostOs: getPlatform(), mockMode: capability.mockMode },
      logger: this.logger,
      cancellationToken: new CancellationToken(),
    };

    // 3. Audit required OS permissions
    const permAudits = await this.permissionManager.checkPermissions(capability);
    const denied = permAudits.filter(a => !a.granted);
    if (denied.length > 0) {
      const errorMsg = `Permission denied for capability [${capability.metadata.id}]: missing required permissions (${denied.map(d => d.permissionId).join(', ')})`;
      return {
        actionNodeId: node.id,
        success: false,
        outputs: {},
        error: errorMsg,
        latencyMs: dispatchMs,
        rollbackRegistered: false,
        warnings: denied.map(d => d.remedyHint),
        timings: { dispatchMs, executionMs: 0, verificationMs: 0 },
      };
    }

    // 4. Execute Native Capability Driver
    const execStart = performance.now();
    const execResult = await capability.execute(ctx);
    const executionMs = performance.now() - execStart;
    execResult.timings.dispatchMs = dispatchMs;

    // 5. Verify execution postconditions & publish verified outputs into ExecutionContext
    const verStart = performance.now();
    let verification: VerificationResult | undefined;
    if (execResult.success) {
      verification = await this.verificationEngine.verifyAndPublish(capability, ctx, execResult);
      // Merge verified outputs into return payload
      Object.assign(execResult.outputs, verification.verifiedOutputs);
      if (!verification.success) {
        execResult.success = false;
        execResult.error = `Execution verification failed for method [${verification.verificationMethod}]`;
        execResult.warnings.push(...(verification.warnings || []));
      }
    }
    const verificationMs = performance.now() - verStart;

    // 6. Register successfully executed action for automated rollback in case of subsequent failures
    let rollbackRegistered = false;
    if (execResult.success) {
      this.rollbackEngine.registerExecutedAction(sessionId, capability, ctx, execResult);
      rollbackRegistered = true;
    }

    const totalLatencyMs = dispatchMs + executionMs + verificationMs;

    return {
      actionNodeId: node.id,
      success: execResult.success,
      outputs: execResult.outputs,
      error: execResult.error,
      latencyMs: totalLatencyMs,
      verification,
      rollbackRegistered,
      diagnostics: execResult.diagnostics,
      warnings: [...execResult.warnings, ...(verification?.warnings || [])],
      timings: {
        dispatchMs,
        executionMs,
        verificationMs,
      },
    };
  }
}
