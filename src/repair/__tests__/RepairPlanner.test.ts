import { describe, it, expect, beforeEach } from 'vitest';
import { RepairPlanner } from '../repair/RepairPlanner';
import { RepairGraphBuilder } from '../repair/RepairGraph';
import { StrategyRegistry } from '../strategies/StrategyRegistry';

describe('RepairPlanner & RepairGraph — Logical Plan Synthesis', () => {
  let planner: RepairPlanner;

  beforeEach(() => {
    planner = new RepairPlanner(new StrategyRegistry(true));
  });

  it('should synthesize a logical Action-based RepairGraph without emitting raw shell commands', async () => {
    const { plan, diagnosis } = await planner.planRepair('network.wifi.connect', 'ENOTFOUND: WiFi SSID connection refused');

    expect(diagnosis.category).toBe('Network');
    expect(plan).toBeDefined();
    expect(plan?.nodes.length).toBeGreaterThan(0);

    // Verify all nodes reference structured Action IDs rather than shell binaries
    for (const node of plan!.nodes) {
      expect(node.actionId.includes(' ')).toBe(false);
      expect(['sh', 'bash', 'zsh', 'exec', 'osascript', 'open'].includes(node.actionId)).toBe(false);
      expect(node.description).toBeDefined();
    }
  });

  it('should construct exact multi-step recovery workflows for hardware state faults (e.g. Bluetooth Off)', () => {
    const mockDiag = { id: 'diag-1', category: 'Network' as any, actionId: 'bluetooth.connect', errorMessage: 'Bluetooth radio power off', timestamp: Date.now(), recoverable: true, remedyHint: 'Enable radio' };
    const graph = RepairGraphBuilder.generateExampleBluetoothRecovery(mockDiag);

    expect(graph.targetActionId).toBe('bluetooth.connect');
    expect(graph.nodes.length).toBe(4);
    
    expect(graph.nodes[0].actionId).toBe('network.bluetooth.on');
    expect(graph.nodes[1].actionId).toBe('system.verify.state');
    expect(graph.nodes[2].actionId).toBe('network.bluetooth.connect');
    expect(graph.nodes[3].actionId).toBe('system.verify.state');

    // Confirm strict dependency ordering across recovery nodes
    expect(graph.nodes[2].dependencies).toContain(graph.nodes[1].id);
  });

  it('should cleanly abort automated plan synthesis when encounters unrecoverable UserCancellation faults', async () => {
    const { plan, diagnosis } = await planner.planRepair('system.long_running', 'Execution aborted via CancellationToken');
    expect(diagnosis.category).toBe('UserCancellation');
    expect(plan).toBeUndefined();
  });
});
