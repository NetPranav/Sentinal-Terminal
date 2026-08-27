import { describe, it, expect } from 'vitest';
import { ShellAdapter } from './ShellAdapter';

describe('ShellAdapter', () => {
  const adapter = ShellAdapter.getInstance();

  it('detects user default login shell from SHELL environment path', () => {
    expect(adapter.detectLoginShell('/bin/zsh').id).toBe('zsh');
    expect(adapter.detectLoginShell('/opt/homebrew/bin/bash').id).toBe('bash');
    expect(adapter.detectLoginShell('/usr/local/bin/fish').id).toBe('fish');
    expect(adapter.detectLoginShell('/opt/homebrew/bin/nu').id).toBe('nushell');
    const expectedDefault = typeof process !== 'undefined' && process.platform === 'darwin' ? 'zsh' : 'bash';
    expect(adapter.detectLoginShell(undefined).id).toBe(expectedDefault);
  });

  it('retrieves accurate shell configuration paths and flags', () => {
    const zsh = adapter.getProfile('zsh');
    expect(zsh.configFilePath).toBe('.zshrc');
    expect(zsh.loginFlag).toBe('-l');
    expect(zsh.supportsTrueColor).toBe(true);

    const bash = adapter.getProfile('bash');
    expect(bash.loginFlag).toBe('--login');
    expect(bash.configFilePath).toBe('.bashrc');
  });

  it('builds interactive login shell execution flags correctly', () => {
    const fish = adapter.getProfile('fish');
    const args = adapter.buildSpawnArgs(fish, true);
    expect(args).toContain('--login');
    expect(args).toContain('-i');
  });

  it('generates standard macOS desktop terminal environment variables', () => {
    const env = adapter.getTerminalEnvironment({ CUSTOM_VAR: 'test' });
    expect(env.TERM).toBe('xterm-256color');
    expect(env.COLORTERM).toBe('truecolor');
    expect(env.TERM_PROGRAM).toBe('Sentinel Terminal');
    expect(env.SENTINEL_TERMINAL).toBe('1');
    expect(env.CUSTOM_VAR).toBe('test');
  });
});
