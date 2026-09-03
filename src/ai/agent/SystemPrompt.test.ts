import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, ToolSpec } from './SystemPrompt';

describe('SystemPrompt — Lean System Prompt Construction', () => {
  const mockTools: ToolSpec[] = [
    { id: 'network.bluetooth.on', name: 'Turn On Bluetooth', description: 'Enable adapter', parameters: [] },
    { id: 'network.bluetooth.connect', name: 'Connect Bluetooth', description: 'Connect peripheral', parameters: [{ name: 'device', type: 'string', required: true, description: '' }] },
    { id: 'network.wifi.connect', name: 'Connect WiFi', description: 'Connect SSID', parameters: [{ name: 'ssid', type: 'string', required: true, description: '' }] },
    { id: 'filesystem.search', name: 'Search Files', description: 'Search directory', parameters: [{ name: 'pattern', type: 'string', required: true, description: '' }] },
    { id: 'git.status', name: 'Git Status', description: 'Check repo status', parameters: [] },
    { id: 'system.service', name: 'Manage Service', description: 'Control systemctl', parameters: [{ name: 'service', type: 'string', required: true, description: '' }] },
    { id: 'system.dotfile', name: 'Manage Dotfile', description: 'Configure rice', parameters: [{ name: 'app', type: 'string', required: true, description: '' }] },
    { id: 'shell.execute', name: 'Execute Shell Command', description: 'Run bash command', parameters: [{ name: 'command', type: 'string', required: true, description: '' }] }
  ];

  it('builds system prompt with full core toolset when no goal is specified', () => {
    const prompt = buildSystemPrompt(mockTools, { os: 'mac', cwd: '/workspace' });
    expect(prompt).toContain('You are Sentinel, a mac terminal AI');
    expect(prompt).toContain('Tools:');
    expect(prompt).toContain('network.bluetooth.on');
    expect(prompt).toContain('filesystem.search');
    expect(prompt).toContain('shell.execute');
  });

  it('dynamically prunes tools to 4-6 relevant candidates when goal is provided', () => {
    const prompt = buildSystemPrompt(
      mockTools,
      { os: 'mac', cwd: '/workspace' },
      'connect bluetooth headphones Space One',
      { maxTools: 3 }
    );

    expect(prompt).toContain('network.bluetooth.connect');
    expect(prompt).toContain('network.bluetooth.on');
    expect(prompt).toContain('shell.execute');

    // Unrelated tools should be pruned out
    expect(prompt).not.toContain('network.wifi.connect');
  });
});
