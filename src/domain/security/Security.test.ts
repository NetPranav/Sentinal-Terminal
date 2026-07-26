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

  beforeEach(() => {
    // Reset singleton for testing (hacky but works for vitest isolated modules)
    const capManager = CapabilityManager.getInstance();
    registry = capManager.getRegistry();
    registry.register(new MockTestCapability());

    permissionManager = new PermissionManager();
    auditLogger = new AuditLogger();
    const securityEngine = new SecurityEngine();
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
    let asked = false;
    const res = await executionEngine.execute('filesystem.delete', { path: '~/Downloads/AAAAAAAA', operation: 'delete' }, {
      onAskPermission: async (plan) => {
        asked = true;
        expect(plan.riskLevel).toBe('ADMIN');
        return true;
      }
    });
    expect(asked).toBe(true);
    expect(res.success).toBe(true);
  });
});
