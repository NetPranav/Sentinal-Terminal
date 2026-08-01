/**
 * BaseCapability.ts — Abstract Base Class for Native macOS Capabilities
 *
 * Enforces metadata immutability, mock mode portability, cancellation checks,
 * telemetry recording, and structured diagnostic responses.
 */

import {
  ICapability,
  CapabilityMetadata,
  CapabilityContext,
  CapabilityResult,
  VerificationResult,
  RollbackResult,
  DiagnosticsReport,
  StateCollectorResult,
} from '../capabilities/CapabilityTypes';
import { globalCapabilityTelemetry } from '../telemetry/CapabilityTelemetry';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export abstract class BaseCapability implements ICapability {
  public mockMode: boolean;
  private _metadata: CapabilityMetadata;

  constructor(metadata: CapabilityMetadata, mockMode: boolean = process.env.NODE_ENV === 'test') {
    this._metadata = { ...metadata };
    this.mockMode = mockMode;
  }

  public get metadata(): CapabilityMetadata {
    return this._metadata;
  }

  public async initialize(): Promise<void> {
    if (!this.mockMode) {
      // In real mode, check basic dependencies if needed
      const diag = await this.diagnostics();
      if (!diag.healthy) {
        this._metadata.health = 'degraded';
      }
    }
  }

  public async execute(ctx: CapabilityContext): Promise<CapabilityResult> {
    const start = performance.now();
    try {
      ctx.cancellationToken.throwIfCancelled();
      ctx.logger.debug(`Executing capability [${this.metadata.id}] for node [${ctx.actionNode.id}] in mockMode=${this.mockMode}`);

      const result = this.mockMode
        ? await this.executeMock(ctx)
        : await this.executeNative(ctx);

      const durationMs = performance.now() - start;
      result.timings.executionMs = durationMs;

      globalCapabilityTelemetry.recordExecution(this.metadata.id, durationMs, result.success, Boolean(result.error?.includes('Permission')));
      return result;
    } catch (err: any) {
      const durationMs = performance.now() - start;
      const errorMsg = err?.message || String(err);
      const isPermission = errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('denied');
      
      globalCapabilityTelemetry.recordExecution(this.metadata.id, durationMs, false, isPermission);
      ctx.logger.error(`Execution failed for capability [${this.metadata.id}]: ${errorMsg}`);

      return {
        success: false,
        outputs: {},
        warnings: [],
        timings: { executionMs: durationMs, dispatchMs: 0 },
        error: errorMsg,
      };
    }
  }

  public async verify(ctx: CapabilityContext, execResult: CapabilityResult): Promise<VerificationResult> {
    const start = performance.now();
    try {
      ctx.cancellationToken.throwIfCancelled();
      const res = this.mockMode
        ? await this.verifyMock(ctx, execResult)
        : await this.verifyNative(ctx, execResult);

      const durationMs = performance.now() - start;
      res.durationMs = durationMs;

      globalCapabilityTelemetry.recordVerification(this.metadata.id, durationMs);
      return res;
    } catch (err: any) {
      const durationMs = performance.now() - start;
      return {
        success: false,
        verifiedOutputs: {},
        durationMs,
        warnings: [`Verification encountered exception: ${err?.message || String(err)}`],
        verificationMethod: 'failed',
        error: err?.message || String(err),
      };
    }
  }

  public async rollback(ctx: CapabilityContext, execResult: CapabilityResult): Promise<RollbackResult> {
    const start = performance.now();
    try {
      ctx.cancellationToken.throwIfCancelled();
      const res = this.mockMode
        ? await this.rollbackMock(ctx, execResult)
        : await this.rollbackNative(ctx, execResult);

      res.durationMs = performance.now() - start;
      globalCapabilityTelemetry.recordRollback(this.metadata.id);
      return res;
    } catch (err: any) {
      return {
        success: false,
        revertedResources: [],
        failedResources: [ctx.actionNode.id],
        durationMs: performance.now() - start,
        warnings: [`Rollback failed: ${err?.message || String(err)}`],
        error: err?.message || String(err),
      };
    }
  }

  public async cancel(actionNodeId: string): Promise<void> {
    // Override if capability maintains active process handles or sockets for actionNodeId
  }

  public async diagnostics(): Promise<DiagnosticsReport> {
    if (this.mockMode) {
      return {
        healthy: true,
        warnings: [],
        missingDependencies: [],
        permissionIssues: [],
        recommendations: [],
      };
    }
    return this.diagnosticsNative();
  }

  public async collectState(): Promise<StateCollectorResult<unknown>> {
    return {
      domain: this.metadata.id,
      tier: 'hot',
      confidence: 1.0,
      data: { status: this.metadata.health, timestamp: Date.now() },
    };
  }

  public async shutdown(): Promise<void> {
    // Clean up any persistent watchers or child process handles
  }

  /**
   * Helper method for running native macOS terminal commands when not in mock mode.
   * Isolates shell invocation completely within the capability class.
   */
  protected async runNativeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    if (this.mockMode) {
      return { stdout: 'Mock command executed successfully', stderr: '' };
    }
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error: any) {
      throw new Error(`Native command execution failed [${command}]: ${error.message || error.stderr || error}`);
    }
  }

  // Abstract native lifecycle routines to be implemented by concrete domain drivers
  protected abstract executeNative(ctx: CapabilityContext): Promise<CapabilityResult>;
  protected abstract verifyNative(ctx: CapabilityContext, execResult: CapabilityResult): Promise<VerificationResult>;
  protected abstract rollbackNative(ctx: CapabilityContext, execResult: CapabilityResult): Promise<RollbackResult>;
  protected abstract diagnosticsNative(): Promise<DiagnosticsReport>;

  // Default mock behavior implementations (can be overridden by domain drivers)
  protected async executeMock(ctx: CapabilityContext): Promise<CapabilityResult> {
    return {
      success: true,
      outputs: { mockExecuted: true, domain: this.metadata.id, ...ctx.actionNode.inputs },
      warnings: [],
      timings: { executionMs: 5, dispatchMs: 0 },
      nativeInvocation: `mock_exec_${this.metadata.id}`,
    };
  }

  protected async verifyMock(ctx: CapabilityContext, execResult: CapabilityResult): Promise<VerificationResult> {
    return {
      success: execResult.success,
      verifiedOutputs: { verified: true, ...execResult.outputs },
      durationMs: 2,
      warnings: [],
      verificationMethod: 'mock_verifier',
    };
  }

  protected async rollbackMock(ctx: CapabilityContext, execResult: CapabilityResult): Promise<RollbackResult> {
    return {
      success: true,
      revertedResources: [`mock_resource_${this.metadata.id}`],
      failedResources: [],
      durationMs: 3,
      warnings: [],
    };
  }
}
