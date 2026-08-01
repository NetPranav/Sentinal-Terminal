/**
 * SecretManager.ts — High-level API for tokens/keys
 */

import { ISecretProvider } from './ISecretProvider';

export class SecretManager {
  constructor(private provider: ISecretProvider) {}

  public async setOAuthToken(serviceId: string, token: string): Promise<void> {
    await this.provider.storeSecret(`oauth_${serviceId}`, token);
  }

  public async getOAuthToken(serviceId: string): Promise<string | null> {
    return await this.provider.retrieveSecret(`oauth_${serviceId}`);
  }

  public async setEncryptionKey(pluginId: string, key: string): Promise<void> {
    await this.provider.storeSecret(`plugin_${pluginId}_key`, key);
  }

  public async clearAllForService(serviceId: string): Promise<void> {
    await this.provider.deleteSecret(`oauth_${serviceId}`);
  }
}
