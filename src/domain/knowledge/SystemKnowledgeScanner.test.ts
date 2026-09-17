import { describe, it, expect, beforeEach } from 'vitest';
import { SystemKnowledgeScanner, SystemProfile } from './SystemKnowledgeScanner';

describe('SystemKnowledgeScanner', () => {
  let scanner: SystemKnowledgeScanner;

  beforeEach(() => {
    scanner = SystemKnowledgeScanner.getInstance();
  });

  it('should generate a valid default profile when scanned', async () => {
    const profile = await scanner.scan(true);
    expect(profile).toBeDefined();
    expect(profile.os).toBeDefined();
    expect(profile.hardware).toBeDefined();
    expect(profile.apps).toBeDefined();
    expect(profile.developer).toBeDefined();
    expect(profile.filesystems).toBeDefined();
    expect(profile.shells).toBeDefined();
    expect(profile.network).toBeDefined();
    expect(profile.services).toBeDefined();
  });

  it('should find applications by partial name or binary', async () => {
    await scanner.scan(true);
    const codeApp = scanner.findApplication('code');
    expect(codeApp).toBeDefined();
    expect(codeApp?.binary.toLowerCase()).toContain('code');

    const browserApp = scanner.findApplication('browser');
    expect(browserApp).toBeDefined();
  });

  it('should produce a concise, high-density quick summary for prompt injection', async () => {
    await scanner.scan(true);
    const summary = scanner.getQuickSummary();
    expect(summary).toContain('SYSTEM KNOWLEDGE PROFILE:');
    expect(summary).toContain('OS:');
    expect(summary).toContain('Hardware:');
    expect(summary).toContain('Storage:');
    expect(summary).toContain('Installed Apps');
  });

  it('should return undefined when searching for non-existent applications', async () => {
    await scanner.scan(true);
    const nonExistent = scanner.findApplication('non_existent_super_rare_app_xyz_123');
    expect(nonExistent).toBeUndefined();
  });
});
