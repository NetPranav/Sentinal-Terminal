/**
 * ToolExecutor.ts — Bridge between AgentLoop and CapabilityRegistrySDK
 * 
 * Executes a tool by ID with given parameters through the SDK driver registry.
 * Handles the mapping from the LLM's tool call to actual OS execution.
 */

import { CapabilityRegistrySDK } from '../../sdk/capabilities/CapabilityRegistrySDK';

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  commandExecuted?: string;
}

export class ToolExecutor {
  private sdk: CapabilityRegistrySDK;

  constructor() {
    this.sdk = CapabilityRegistrySDK.getInstance();
  }

  /**
   * Execute a tool by its registry ID with the given parameters.
   * Returns a simplified result the LLM can understand.
   */
  public async execute(toolId: string, params: Record<string, any>, cwd?: string): Promise<ToolExecutionResult> {
    try {
      const result = await this.sdk.executeTool(toolId, params, { cwd });

      if (result.success) {
        return {
          success: true,
          data: result.data,
          commandExecuted: result.commandExecuted
        };
      } else {
        return {
          success: false,
          error: result.error?.message || 'Tool execution failed',
          commandExecuted: result.commandExecuted
        };
      }
    } catch (err: any) {
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
