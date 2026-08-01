import { describe, it, expect, beforeEach } from 'vitest';
import { VerificationEngine } from '../verification/VerificationEngine';
import { RollbackEngine } from '../rollback/RollbackEngine';
import { CapabilityExecutor } from '../execution/CapabilityExecutor';
import { CapabilityRegistry } from '../registry/CapabilityRegistry';
import { ExecutionContext } from '../../runtime/state/ExecutionContext';
import { createTestNode } from './testHelpers';

describe('Decentralized Orchestration — Verification & Rollback Engines', () => {
  let registry: CapabilityRegistry;
  let executor: CapabilityExecutor;
  let context: ExecutionContext;

  beforeEach(() => {
    registry = new CapabilityRegistry(true);
    executor = new CapabilityExecutor(registry);
    context = new ExecutionContext();
  });

  it('should verify execution and publish structured verified outputs directly into ExecutionContext', async () => {
    const node = createTestNode('node-wifi-1', 'wifi.connect', { ssid: 'Corporate_5GHz' });

    // Execute through bridge passing real session ExecutionContext
    const res = await executor.execute(node, context, 'sess-verif');
    expect(res.success).toBe(true);

    // Verify outputs were published directly into ExecutionContext for downstream consumption
    expect(context.getOutput('node-wifi-1', 'connectedSSID')).toBe('Corporate_5GHz');
    expect(context.getOutput('node-wifi-1', 'interface')).toBe('en0');
    expect(context.getOutput('node-wifi-1', 'ipAddress')).toBeDefined();
    expect(res.verification?.verificationMethod).toContain('verifier');
  });

  it('should collect executed steps in RollbackEngine and return rich structured rollback metadata on revert', async () => {
    const node1 = createTestNode('n1', 'filesystem.create_folder', { path: '/tmp/test_rollback_1' });
    const node2 = createTestNode('n2', 'bluetooth.enable', { state: 'on' });

    await executor.execute(node1, context, 'sess-rollback-test');
    await executor.execute(node2, context, 'sess-rollback-test');

    // Trigger session rollback
    const rollbackRes = await executor.rollbackEngine.rollbackSession('sess-rollback-test');

    expect(rollbackRes.success).toBe(true);
    expect(rollbackRes.revertedResources).toHaveLength(2);
    expect(rollbackRes.revertedResources).toContain('mock_resource_bluetooth');
    expect(rollbackRes.revertedResources).toContain('mock_resource_filesystem');
    expect(typeof rollbackRes.durationMs).toBe('number');
    expect(rollbackRes.failedResources).toHaveLength(0);
  });
});
