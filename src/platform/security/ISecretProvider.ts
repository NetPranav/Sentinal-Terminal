/**
 * ISecretProvider.ts — Abstraction for OS secure storage
 */

export interface ISecretProvider {
  readonly providerName: string;
  storeSecret(key: string, value: string): Promise<void>;
  retrieveSecret(key: string): Promise<string | null>;
  deleteSecret(key: string): Promise<void>;
}
