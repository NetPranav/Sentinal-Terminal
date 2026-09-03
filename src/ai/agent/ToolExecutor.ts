/**
 * ToolExecutor.ts — Bridge between AgentLoop and CapabilityRegistrySDK
 * 
 * Executes a tool by ID with given parameters through the SDK driver registry.
 * Handles the mapping from the LLM's tool call to actual OS execution.
 */

import { CapabilityRegistrySDK } from '../../sdk/capabilities/CapabilityRegistrySDK';
import { CapabilityManager } from '../../domain/Capability';
import { AuditLogger } from '../../domain/security/AuditLogger';
import { ExecutionEngine, ExecutionPreviewPlan } from '../../domain/security/ExecutionEngine';
import { PermissionManager } from '../../domain/security/PermissionManager';
import { PolicyEngine } from '../../domain/security/PolicyEngine';
import { SecurityEngine } from '../../domain/security/SecurityEngine';

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  commandExecuted?: string;
}

export class ToolExecutor {
  private sdk: CapabilityRegistrySDK;
  private executionEngine: ExecutionEngine;

  constructor() {
    this.sdk = CapabilityRegistrySDK.getInstance();
    this.executionEngine = new ExecutionEngine(
      CapabilityManager.getInstance(),
      PermissionManager.getInstance(),
      new SecurityEngine(),
      new PolicyEngine(),
      AuditLogger.getInstance()
    );
  }

  public static readonly DEFAULT_TIMEOUT_MS = 30000;

  /**
   * Execute a tool by its registry ID with the given parameters.
   * Returns a simplified result the LLM can understand, guarded with a timeout.
   */
  public async execute(
    toolId: string,
    params: Record<string, any>,
    cwd?: string,
    onAskPermission?: (plan: ExecutionPreviewPlan) => Promise<boolean>,
    timeoutMs: number = ToolExecutor.DEFAULT_TIMEOUT_MS
  ): Promise<ToolExecutionResult> {
    let timeoutHandle: any = null;
    try {
      const timeoutPromise = new Promise<ToolExecutionResult>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const execPromise = (async (): Promise<ToolExecutionResult> => {
        const result = await this.executionEngine.execute(toolId, params, {
          cwd,
          onAskPermission,
          timeoutMs
        });

        if (result.success) {
          return {
            success: true,
            data: result.data
          };
        } else {
          return {
            success: false,
            error: result.error?.message || String(result.error || 'Tool execution failed')
          };
        }
      })();

      const finalResult = await Promise.race([execPromise, timeoutPromise]);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      return finalResult;
    } catch (err: any) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      // Cancel active driver if running
      try {
        const driver = this.sdk.getDriver(toolId);
        if (driver) await driver.cancel();
      } catch { /* ignore cancel failure */ }

      return {
        success: false,
        error: err.message || 'Unexpected execution error'
      };
    }
  }

  /**
   * Check if a tool ID has a registered driver.
   */
  public hasDriver(toolId: string): boolean {
    return this.sdk.getDriver(toolId) !== undefined;
  }

  /**
   * Get all registered tool IDs for diagnostics.
   */
  public getRegisteredToolIds(): string[] {
    return this.sdk.getAllRegisteredIds();
  }
}
