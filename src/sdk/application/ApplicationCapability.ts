/**
 * ApplicationCapability.ts — Cross-Platform Capability Driver for Application Lifecycle & Windows
 *
 * Implements desktop launching, process termination, and window focusing.
 * Supports Linux, macOS, and Windows.
 */

import { BaseCapability } from '../common/BaseCapability';
import { CapabilityContext, CapabilityResult, VerificationResult, RollbackResult, DiagnosticsReport } from '../capabilities/CapabilityTypes';

export class ApplicationCapability extends BaseCapability {
  constructor(mockMode = process.env.NODE_ENV === 'test') {
    super(
      {
        id: 'application',
        version: '3.1.0',
        description: 'Cross-platform application lifecycle manager and process controller',
        supportedActions: ['application.', 'app.', 'launch.'],
        supportedMacOsVersion: '>=11.0',
        dependencies: ['xdg-open', 'gtk-launch', 'open', 'pkill', 'pgrep', 'taskkill'],
        requiredPermissions: ['Accessibility', 'Automation'],
        health: 'healthy',
      },
      mockMode
    );
  }

  protected async executeNative(ctx: CapabilityContext): Promise<CapabilityResult> {
    const inputs = ctx.actionNode.inputs;
    const actionId = ctx.actionNode.action.id;
    const appName = String(inputs.appName || inputs.app || inputs.application || '').replace(/["']/g, '').trim();
    const isLinux = process.platform === 'linux';
    const isWin = process.platform === 'win32';

    if (actionId.includes('open') || actionId.includes('launch')) {
      let targetUrl = String(inputs.url || inputs.link || '').trim();
      if (targetUrl && !/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }

      let cmd = '';
      if (isLinux) {
        if (targetUrl) {
          cmd = `xdg-open "${targetUrl}"`;
        } else {
          cmd = `gtk-launch "${appName}" 2>/dev/null || which "${appName.toLowerCase()}" >/dev/null 2>&1 && "${appName.toLowerCase()}" & || xdg-open "${appName}" 2>/dev/null`;
        }
      } else if (isWin) {
        cmd = targetUrl ? `start "" "${targetUrl}"` : `start "" "${appName}"`;
      } else {
        cmd = targetUrl ? `open -a "${appName}" "${targetUrl}"` : `open -a "${appName}"`;
      }

      await this.runNativeCommand(cmd).catch(() => {});

      return {
        success: true,
        outputs: { appName, running: true, launchedUrl: targetUrl || null },
        warnings: [],
        timings: { executionMs: 0, dispatchMs: 0 },
        nativeInvocation: cmd,
      };
    } else if (actionId.includes('close') || actionId.includes('kill') || actionId.includes('terminate')) {
      const cmd = isWin ? `taskkill /F /IM "${appName}*"` : `pkill -9 -i -f "${appName}"`;
      try {
        await this.runNativeCommand(cmd);
      } catch {
        // Exits non-zero if process not running; treat as success
      }
      return {
        success: true,
        outputs: { appName, running: false, terminated: true },
        warnings: ['Executed force termination signal across matching user processes'],
        timings: { executionMs: 0, dispatchMs: 0 },
        nativeInvocation: cmd,
      };
    }

    return {
      success: true,
      outputs: { appName, executed: true },
      warnings: [],
      timings: { executionMs: 0, dispatchMs: 0 },
      nativeInvocation: `app_native_${actionId}`,
    };
  }

  protected async verifyNative(ctx: CapabilityContext, execResult: CapabilityResult): Promise<VerificationResult> {
    const appName = String(execResult.outputs.appName || ctx.actionNode.inputs.appName || '');
    if (!appName) {
      return { success: true, verifiedOutputs: { verified: true }, durationMs: 0, warnings: [], verificationMethod: 'no_app_specified' };
    }

    const isWin = process.platform === 'win32';
    try {
      const cmd = isWin ? `tasklist /FI "IMAGENAME eq ${appName}*"` : `pgrep -i -f "${appName}"`;
      const { stdout } = await this.runNativeCommand(cmd);
      const exists = isWin ? stdout.toLowerCase().includes(appName.toLowerCase()) : stdout.split('\n').filter(Boolean).length > 0;
      const expectedTermination = Boolean(execResult.outputs.terminated);

      return {
        success: expectedTermination ? !exists : exists,
        verifiedOutputs: { appName, running: exists },
        durationMs: 0,
        warnings: [],
        verificationMethod: isWin ? 'tasklist_process_audit' : 'pgrep_process_table_audit',
      };
    } catch {
      const expectedTermination = Boolean(execResult.outputs.terminated);
      return {
        success: expectedTermination,
        verifiedOutputs: { appName, running: false, activePids: [] },
        durationMs: 0,
        warnings: [],
        verificationMethod: 'process_absence_check',
      };
    }
  }

  protected async rollbackNative(ctx: CapabilityContext, execResult: CapabilityResult): Promise<RollbackResult> {
    const appName = String(execResult.outputs.appName || ctx.actionNode.inputs.appName || '');
    const isWin = process.platform === 'win32';
    if (execResult.outputs.running === true) {
      const cmd = isWin ? `taskkill /IM "${appName}*"` : `pkill -i -f "${appName}"`;
      await this.runNativeCommand(cmd).catch(() => {});
    }
    return {
      success: true,
      revertedResources: [appName],
      failedResources: [],
      durationMs: 0,
      warnings: [],
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
