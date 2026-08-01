import { describe, it, expect, beforeEach } from 'vitest';
import { SecretManager } from '../security/SecretManager';
import { ISecretProvider } from '../security/ISecretProvider';
import { ReleaseMetadata } from '../release/ReleaseMetadata';

class MockKeychain implements ISecretProvider {
  providerName = 'Mock OS Keychain';
  private vault = new Map<string, string>();
  
  async storeSecret(key: string, value: string) { this.vault.set(key, value); }
  async retrieveSecret(key: string) { return this.vault.get(key) || null; }
  async deleteSecret(key: string) { this.vault.delete(key); }
}

describe('Production Platform — Security & Secrets', () => {
  it('SecretManager should securely proxy arbitrary keys to the active OS provider', async () => {
    const provider = new MockKeychain();
    const secrets = new SecretManager(provider);
    
    await secrets.setOAuthToken('github', 'gh_abc123');
    expect(await secrets.getOAuthToken('github')).toBe('gh_abc123');
    
    await secrets.clearAllForService('github');
    expect(await secrets.getOAuthToken('github')).toBeNull();
  });

  it('ReleaseMetadata should supply complete schema bounds', () => {
    const info = ReleaseMetadata.getInfo();
    expect(info.version).toBe('3.0.0');
    expect(info.schemas.workflow).toBe('v1.4');
  });
});
