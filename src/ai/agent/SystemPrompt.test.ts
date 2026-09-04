import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, ToolSpec } from './SystemPrompt';

describe('SystemPrompt — Shell-Native Autonomous Copilot Prompt', () => {
  const mockTools: ToolSpec[] = [
    { id: 'shell.execute', name: 'Execute Shell Command', description: 'Run shell command', parameters: [{ name: 'command', type: 'string', required: true, description: '' }] }
  ];

  it('builds shell-native system prompt for macOS with zero-refusal rules and JSON contract', () => {
    const prompt = buildSystemPrompt(mockTools, { os: 'mac', cwd: '/Users/test/projects' });
    expect(prompt).toContain('You are Sentinel, an autonomous mac terminal AI copilot.');
    expect(prompt).toContain('Working Directory: /Users/test/projects');
    expect(prompt).toContain('Shell: /bin/zsh');
    expect(prompt).toContain('CRITICAL RULES:');
    expect(prompt).toContain('YOU MUST NEVER REFUSE ACTIONABLE SYSTEM REQUESTS');
    expect(prompt).toContain('JSON CONTRACT:');
    expect(prompt).toContain('{"action": "execute", "command": "<terminal_command>", "explanation": "<1-line plain English explanation of what this command will do>"}');
  });

  it('builds shell-native system prompt for Windows with PowerShell', () => {
    const prompt = buildSystemPrompt(mockTools, { os: 'windows', cwd: 'C:\\Users\\test' });
    expect(prompt).toContain('Shell: powershell');
    expect(prompt).toContain('Working Directory: C:\\Users\\test');
  });

  it('includes key terminal command examples for fast Spotlight, network, and port queries', () => {
    const prompt = buildSystemPrompt(mockTools, { os: 'mac', cwd: '/workspace' });
    expect(prompt).toContain('mdfind');
    expect(prompt).toContain('networksetup');
    expect(prompt).toContain('lsof');
    expect(prompt).toContain('pmset');
  });
});
