/**
 * ShellSDKCapability.ts — Concrete Execution Driver for Explicit Shell Commands
 * 
 * Mapped from Tool Registry: "shell.execute"
 */

import { BaseCapabilityDriver, CapabilityExecutionResult, ExecutionContext, Platform } from '../CapabilitySDK';
import { invoke } from '@tauri-apps/api/core';

export interface ShellDriverInput {
  command: string;
  args?: string[];
  cwd?: string;
}

export class ShellSDKCapability extends BaseCapabilityDriver<ShellDriverInput, any> {
  readonly capabilityId = 'shell.execute';
  readonly name = 'Arbitrary Shell Execution Driver';
  readonly supportedPlatforms: Platform[] = ['macos', 'windows', 'linux'];

  private runningPid?: number;

  public async run(command: string, args: string[] = []): Promise<CapabilityExecutionResult<{ stdout: string; stderr: string; code: number }>> {
    return this.execute({ command, args });
  }

  protected async performExecution(
    input: ShellDriverInput,
    _context: ExecutionContext,
    cancelToken: { cancelled: boolean }
  ): Promise<CapabilityExecutionResult<any>> {
    if (cancelToken.cancelled) {
      return { success: false, cancelled: true };
    }

    if (!input.command) {
      return { success: false, error: { code: 'MISSING_SHELL_CMD', message: 'Command string required for shell.execute' } };
    }

    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return {
        success: true,
        data: { stdout: `mock output for ${input.command}`, stderr: '', code: 0 },
        commandExecuted: `${input.command} ${(input.args || []).join(' ')}`
      };
    }

    try {
      const output = await invoke<{ stdout: string; stderr: string; code: number; pid?: number }>('execute_command', {
        command: input.command,
        args: input.args || [],
        cwd: input.cwd
      });

      if (output.pid) {
        this.runningPid = output.pid;
      }

      const isSuccess = output.code === 0;
      return {
        success: isSuccess,
        data: { stdout: output.stdout, stderr: output.stderr, code: output.code },
        error: !isSuccess ? { code: 'NON_ZERO_EXIT', message: `Command exited with status code ${output.code}: ${output.stderr || output.stdout}` } : undefined,
        commandExecuted: `${input.command} ${(input.args || []).join(' ')}`
      };
    } catch (e: any) {
      return { success: false, error: { code: 'SHELL_INVOKER_ERROR', message: e.message || 'Error occurred while executing command in shell' } };
    }
  }

  public async verify(_input: ShellDriverInput, result: CapabilityExecutionResult<any>): Promise<boolean> {
    return result.success && result.data?.code === 0;
  }

  public async cancel(): Promise<boolean> {
    const cancelled = await super.cancel();
    if (this.runningPid) {
      try {
        await invoke('kill_process', { pid: this.runningPid });
      } catch {
        // ignore errors during process termination
      }
    }
    return cancelled;
  }
}
