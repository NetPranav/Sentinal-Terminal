import { describe, it, expect, beforeEach } from 'vitest';
import { DiagnosticsManager } from '../diagnostics/DiagnosticsManager';
import { PermissionManager } from '../permissions/PermissionManager';
import { CapabilityRegistry } from '../registry/CapabilityRegistry';
import { CapabilityExecutor } from '../execution/CapabilityExecutor';
import { createTestNode } from './testHelpers';

describe('Structured Diagnostics & Permission Manager', () => {
  let registry: CapabilityRegistry;
  let diagManager: DiagnosticsManager;
  let permManager: PermissionManager;
  let executor: CapabilityExecutor;

  beforeEach(() => {
    registry = new CapabilityRegistry(true);
    diagManager = new DiagnosticsManager();
    permManager = new PermissionManager(true); // default mock mode
    executor = new CapabilityExecutor(registry, undefined, undefined, permManager);
  });

  it('should return completely structured diagnostic reports for individual capabilities and aggregate sweeps', async () => {
    const caps = registry.getAllCapabilities();
    const report = await diagManager.diagnoseAll(caps);

    expect(report).toHaveProperty('healthy', true);
    expect(Array.isArray(report.warnings)).toBe(true);
    expect(Array.isArray(report.missingDependencies)).toBe(true);
    expect(Array.isArray(report.permissionIssues)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('should audit required capability permissions and provide structured remedy instructions', async () => {
    const fsCap = registry.lookup('filesystem')!;
    expect(fsCap.metadata.requiredPermissions).toContain('Full Disk Access');

    const audits = await permManager.checkPermissions(fsCap);
    expect(audits).toHaveLength(1);
    expect(audits[0].permissionId).toBe('Full Disk Access');
    expect(audits[0].granted).toBe(true);
    expect(audits[0].remedyHint).toContain('System Settings > Privacy & Security');
  });

  it('should intercept execution cleanly when a required OS permission is explicitly denied', async () => {
    // Override permission status in memory to simulate user denying access
    permManager.setGrant('Full Disk Access', false);

    const node = createTestNode('node-fs-denies', 'filesystem.delete', { path: '/protected/dir' });
    const result = await executor.execute(node);

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing required permissions (Full Disk Access)');
    expect(result.warnings[0]).toContain('System Settings > Privacy & Security > Full Disk Access');
    expect(result.timings.executionMs).toBe(0); // Execution prevented before native invocation
  });
});
