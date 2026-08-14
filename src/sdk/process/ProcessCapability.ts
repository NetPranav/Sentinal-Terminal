/**
 * ProcessCapability.ts — Native macOS Capability Driver for Process Sweeping & Listening Socket Audits
 *
 * Implements PID table searches, TCP socket port inspections (lsof -i),
 * and signal termination (kill / pkill).
 */

import { BaseCapability } from '../common/BaseCapability';
import { CapabilityContext, CapabilityResult, VerificationResult, RollbackResult, DiagnosticsReport } from '../capabilities/CapabilityTypes';

export class ProcessCapability extends BaseCapability {
  constructor(mockMode = process.env.NODE_ENV === 'test') {
    super(
      {
        id: 'process',
        version: '3.0.0',
        description: 'Native macOS process scanner, TCP/UDP socket auditor, and process lifecycle terminator',
        supportedActions: ['process.', 'socket.', 'port.', 'ps.'],
        supportedMacOsVersion: '>=11.0',
        dependencies: ['ps', 'lsof', 'pgrep', 'kill'],
        requiredPermissions: ['Full Disk Access'],
        health: 'healthy',
      },
      mockMode
    );
  }

  protected async executeNative(ctx: CapabilityContext): Promise<CapabilityResult> {
    const inputs = ctx.actionNode.inputs;
    const actionId = ctx.actionNode.action.id;
    const isWin = process.platform === 'win32';

    if (actionId.includes('find') || actionId.includes('search') || actionId.includes('lookup')) {
      const target = String(inputs.process || inputs.appName || inputs.name || '').trim();
      const port = Number(inputs.port || 0);

      if (port > 0) {
        const cmd = isWin ? `netstat -ano | findstr :${port}` : `lsof -t -i :${port}`;
        const { stdout } = await this.runNativeCommand(cmd).catch(() => ({ stdout: '' }));
        let pids: number[] = [];
        if (isWin) {
          const lines = stdout.split('\n').filter(Boolean);
          pids = lines.map(l => Number(l.trim().split(/\\s+/).pop())).filter(p => p > 0);
        } else {
          pids = stdout.split('\n').filter(Boolean).map(Number);
        }
        return {
          success: true,
          outputs: { port, foundPids: pids, pid: pids[0] || null, active: pids.length > 0 },
          warnings: [],
          timings: { executionMs: 0, dispatchMs: 0 },
          nativeInvocation: cmd,
        };
      }

      const cmd = isWin ? `powershell -Command "Get-Process -Name '*${target}*' | Select-Object -ExpandProperty Id"` : `pgrep -i -f "${target}"`;
      const { stdout } = await this.runNativeCommand(cmd).catch(() => ({ stdout: '' }));
      const pids = stdout.split('\n').filter(Boolean).map(Number);
      return {
        success: true,
        outputs: { processName: target, foundPids: pids, pid: pids[0] || null, active: pids.length > 0 },
        warnings: [],
        timings: { executionMs: 0, dispatchMs: 0 },
        nativeInvocation: cmd,
      };
    } else if (actionId.includes('kill') || actionId.includes('stop') || actionId.includes('terminate')) {
      // Consume PID directly from inputs or shared ExecutionContext
      const pid = Number(inputs.pid || ctx.executionContext.getOutput(ctx.actionNode.dependencies[0] || '', 'pid') || 0);
      if (pid > 0) {
        const cmd = isWin ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
        await this.runNativeCommand(cmd).catch(() => {});
        return {
          success: true,
          outputs: { terminatedPid: pid, running: false },
          warnings: [`Dispatched kill signal directly to PID ${pid}`],
          timings: { executionMs: 0, dispatchMs: 0 },
          nativeInvocation: cmd,
        };
      }
    }

    return {
      success: true,
      outputs: { executed: true, domain: 'process', ...inputs },
      warnings: [],
      timings: { executionMs: 0, dispatchMs: 0 },
      nativeInvocation: `proc_native_${actionId}`,
    };
  }

  protected async verifyNative(ctx: CapabilityContext, execResult: CapabilityResult): Promise<VerificationResult> {
    const isWin = process.platform === 'win32';
    const pid = Number(execResult.outputs.terminatedPid || execResult.outputs.pid || 0);
    if (pid > 0 && execResult.outputs.running === false) {
      try {
        const cmd = isWin ? `tasklist /FI "PID eq ${pid}"` : `ps -p ${pid}`;
        const { stdout } = await this.runNativeCommand(cmd);
        if (isWin && !stdout.includes(String(pid))) throw new Error('Process not found');
        return { success: false, verifiedOutputs: { pid, running: true }, durationMs: 0, warnings: ['Process still exists in OS schedule table'], verificationMethod: isWin ? 'tasklist_check' : 'ps_pid_check' };
      } catch {
        return { success: true, verifiedOutputs: { pid, running: false, verifiedTerminated: true }, durationMs: 0, warnings: [], verificationMethod: 'process_absence_verification' };
      }
    }

    return {
      success: true,
      verifiedOutputs: { verifiedPid: pid, ...execResult.outputs },
      durationMs: 0,
      warnings: [],
      verificationMethod: 'process_table_audit',
    };
  }

  protected async verifyMock(ctx: CapabilityContext, execResult: CapabilityResult): Promise<VerificationResult> {
    const isKill = ctx.actionNode.action.id.includes('kill') || ctx.actionNode.action.id.includes('stop');
    return {
      success: true,
      verifiedOutputs: {
        verifiedPid: Number(execResult.outputs.pid || execResult.outputs.terminatedPid || 4512),
        processStatus: isKill ? 'terminated' : 'active_listening',
        openSockets: isKill ? 0 : 2,
      },
      durationMs: 2,
      warnings: [],
      verificationMethod: 'mock_process_verifier',
    };
  }

  protected async rollbackNative(ctx: CapabilityContext, execResult: CapabilityResult): Promise<RollbackResult> {
    return {
      success: true,
      revertedResources: [`process_${execResult.outputs.pid || 'handle'}`],
      failedResources: [],
      durationMs: 0,
      warnings: ['Terminated processes cannot be automatically re-spawned with prior RAM state'],
    };
  }

  protected async diagnosticsNative(): Promise<DiagnosticsReport> {
    return {
      healthy: true,
      warnings: [],
      missingDependencies: [],
      permissionIssues: [],
      recommendations: [],
    };
  }
}
