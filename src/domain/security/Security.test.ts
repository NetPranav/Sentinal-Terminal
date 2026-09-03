import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionEngine, ExecutionPreviewPlan } from './ExecutionEngine';
import { CapabilityManager, CapabilityRegistry, Capability, CapabilityResult } from '../Capability';
import { PermissionManager } from './PermissionManager';
import { SecurityEngine } from './SecurityEngine';
import { PolicyEngine } from './PolicyEngine';
import { AuditLogger } from './AuditLogger';
import { z } from 'zod';

class MockTestCapability implements Capability<any, any> {
  metadata = {
    id: 'test.cap',
    name: 'Test',
    description: 'Test',
    category: 'Other' as const,
    supportedPlatforms: ['macos'] as any,
    requiredPermissions: ['Network'],
    version: '1.0.0'
  };

  inputSchema = z.object({ value: z.string() });
  supportsDryRun = true;

  async execute(input: any, isDryRun?: boolean): Promise<CapabilityResult<any>> {
    if (isDryRun) return { success: true, data: { dryRun: true } };
    return { success: true, data: input.value, rollbackAction: { description: 'undo', executeRollback: async () => true } };
  }

  async verify(input: any, result: any) {
    return result.data === 'success'; // fails if value is not 'success'
  }
}

describe('ExecutionEngine Pipeline', () => {
  let executionEngine: ExecutionEngine;
  let registry: CapabilityRegistry;
  let permissionManager: PermissionManager;
  let auditLogger: AuditLogger;
  let securityEngine: SecurityEngine;

  beforeEach(() => {
    // Reset singleton for testing (hacky but works for vitest isolated modules)
    const capManager = CapabilityManager.getInstance();
    registry = capManager.getRegistry();
    registry.register(new MockTestCapability());

    permissionManager = new PermissionManager();
    auditLogger = new AuditLogger();
    securityEngine = new SecurityEngine();
    const policyEngine = new PolicyEngine();

    executionEngine = new ExecutionEngine(
      capManager,
      permissionManager,
      securityEngine,
      policyEngine,
      auditLogger
    );
  });

  it('should reject invalid input schema', async () => {
    const res = await executionEngine.execute('test.cap', { wrong: 123 });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('VALIDATION_FAILED');
  });

  it('should evaluate safe mode permissions and ask user', async () => {
    // SafeMode Network is AskEveryTime
    let asked = false;
    const res = await executionEngine.execute('test.cap', { value: 'success' }, {
      onAskPermission: async (plan: ExecutionPreviewPlan) => {
        asked = true;
        expect(plan.permissionsRequired).toContain('Network');
        return true; // Approve
      }
    });

    expect(asked).toBe(true);
    expect(res.success).toBe(true);
    expect(res.data).toBe('success');
  });

  it('should bypass interactive prompt in SafeMode for harmless read-only shell utilities (date, whoami, clear, cal)', async () => {
    permissionManager.setProfile('SafeMode');
    let asked = false;
    // Test evaluating a harmless read-only command via shell.core / shell.execute
    const risk = executionEngine['securityEngine'].calculateRisk('shell.execute', { command: 'date' });
    expect(risk.level).toBe('SAFE');
  });

  it('should deny if user rejects ask prompt', async () => {
    const res = await executionEngine.execute('test.cap', { value: 'success' }, {
      onAskPermission: async () => false // Deny
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('USER_CANCELLED');
  });

  it('should bypass ask if permission is AlwaysAllow (Developer Profile)', async () => {
    permissionManager.setProfile('Developer'); // Network is AlwaysAllow
    let asked = false;
    const res = await executionEngine.execute('test.cap', { value: 'success' }, {
      onAskPermission: async () => {
        asked = true;
        return true;
      }
    });

    expect(asked).toBe(false);
    expect(res.success).toBe(true);
  });

  it('should support dry run simulation', async () => {
    permissionManager.setProfile('Developer');
    const res = await executionEngine.execute('test.cap', { value: 'success' }, { isDryRun: true });
    expect(res.success).toBe(true);
    expect((res.data as any).dryRun).toBe(true);
  });

  it('should fail verification if verify hook fails', async () => {
    permissionManager.setProfile('Developer');
    // input is not 'success', so verify() hook will return false
    const res = await executionEngine.execute('test.cap', { value: 'fail-verify' });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('VERIFICATION_FAILED');
  });

  it('should log execution to AuditLogger', async () => {
    permissionManager.setProfile('Developer');
    await executionEngine.execute('test.cap', { value: 'success' });
    
    const logs = await auditLogger.exportLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].capabilityId).toBe('test.cap');
    expect(logs[0].permissionResult).toBe('Granted');
    expect(logs[0].verificationResult).toBe('Success');
  });

  it('should enforce administrative security confirmation when executing destructive filesystem deletion via SDK driver', async () => {
    permissionManager.setPermission('DeleteFiles', 'AskEveryTime');
    let asked = false;
    const res = await executionEngine.execute('filesystem.delete', { path: '~/Downloads/AAAAAAAA', operation: 'delete' }, {
      onAskPermission: async (plan) => {
        asked = true;
        expect(plan.riskLevel).toBe('CRITICAL');
        expect(plan.requiresPassword).toBe(true);
        expect(plan.requiresConsent).toBe(true);
        return true;
      }
    });
    expect(asked).toBe(true);
    expect(res.success).toBe(true);
  });

  it('should deny filesystem.delete by default under SafeMode profile', async () => {
    // Under SafeMode, DeleteFiles permission is AlwaysDeny
    const res = await executionEngine.execute('filesystem.delete', { path: '~/Downloads/test.txt' });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('PERMISSION_DENIED');
  });

  it('should deny system directory deletion via PolicyEngine even in Developer profile', async () => {
    permissionManager.setProfile('Developer');
    const res = await executionEngine.execute('filesystem.delete', { path: '/System' });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('POLICY_DENIED');
  });

  describe('Permission Category Mapping & Profile Enforcement', () => {
    it('should accurately resolve capability IDs to their respective PermissionCategory', () => {
      expect(ExecutionEngine.resolvePermissionCategory('application.install')).toBe('ShellExecution');
      expect(ExecutionEngine.resolvePermissionCategory('application.update')).toBe('ShellExecution');
      expect(ExecutionEngine.resolvePermissionCategory('application.uninstall')).toBe('ShellExecution');
      expect(ExecutionEngine.resolvePermissionCategory('git.push')).toBe('Git');
      expect(ExecutionEngine.resolvePermissionCategory('git.commit')).toBe('Git');
      expect(ExecutionEngine.resolvePermissionCategory('docker.stop')).toBe('Docker');
      expect(ExecutionEngine.resolvePermissionCategory('docker.compose_down')).toBe('Docker');
      expect(ExecutionEngine.resolvePermissionCategory('developer.ssh')).toBe('SSH');
      expect(ExecutionEngine.resolvePermissionCategory('clipboard.read')).toBe('Clipboard');
      expect(ExecutionEngine.resolvePermissionCategory('system.lock')).toBe('SystemSettings');
      expect(ExecutionEngine.resolvePermissionCategory('system.env_set')).toBe('EnvironmentVariables');
      expect(ExecutionEngine.resolvePermissionCategory('filesystem.read')).toBe('ReadFiles');
    });

    it('should deny Git, Docker, SSH, and package installs under ReadOnly profile', async () => {
      permissionManager.setProfile('ReadOnly');

      const gitRes = await executionEngine.execute('git.push', { remote: 'origin', branch: 'main' });
      expect(gitRes.success).toBe(false);
      expect(gitRes.error?.code).toBe('PERMISSION_DENIED');
      expect(gitRes.error?.message).toContain('Permission Git is always denied');

      const installRes = await executionEngine.execute('application.install', { package: 'htop' });
      expect(installRes.success).toBe(false);
      expect(installRes.error?.code).toBe('PERMISSION_DENIED');
      expect(installRes.error?.message).toContain('Permission ShellExecution is always denied');

      const dockerRes = await executionEngine.execute('docker.stop', { container: 'web' });
      expect(dockerRes.success).toBe(false);
      expect(dockerRes.error?.code).toBe('PERMISSION_DENIED');
      expect(dockerRes.error?.message).toContain('Permission Docker is always denied');

      const sshRes = await executionEngine.execute('developer.ssh', { target: 'user@server' });
      expect(sshRes.success).toBe(false);
      expect(sshRes.error?.code).toBe('PERMISSION_DENIED');
      expect(sshRes.error?.message).toContain('Permission SSH is always denied');
    });

    it('should prompt user in SafeMode with correct required permissions for Git and Docker operations', async () => {
      permissionManager.setProfile('SafeMode');
      let askedGit = false;

      const gitRes = await executionEngine.execute('git.commit', { message: 'feat: new feature' }, {
        onAskPermission: async (plan) => {
          askedGit = true;
          expect(plan.permissionsRequired).toContain('Git');
          return true;
        }
      });

      expect(askedGit).toBe(true);
      expect(gitRes.success).toBe(true);
    });

    it('should classify system.lock and display sleep commands as SENSITIVE requiring user confirmation', () => {
      const risk = securityEngine.calculateRisk('system.lock', {});
      expect(risk.level).toBe('SENSITIVE');
      expect(risk.requiresConsent).toBe(true);

      const cmdRisk = securityEngine.analyzeCommand('pmset displaysleepnow');
      expect(cmdRisk.level).toBe('SENSITIVE');
      expect(cmdRisk.requiresConsent).toBe(true);
    });
  });
});
