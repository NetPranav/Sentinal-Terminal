import { describe, it, expect } from 'vitest';
import { ManifestValidator } from '../manifest/ManifestValidator';

describe('ManifestValidator', () => {
  it('should accept valid manifests', () => {
    const raw = {
      id: 'com.example.plugin',
      name: 'Example Plugin',
      version: '1.0.0',
      author: 'Test',
      description: 'Test plugin',
      license: 'MIT',
      sdkVersion: '1.0.0',
      entrypoint: 'index.js',
      executionModel: 'workflow',
      permissions: ['filesystem.read']
    };
    const valid = ManifestValidator.validate(raw);
    expect(valid.id).toBe('com.example.plugin');
  });

  it('should reject invalid version strings', () => {
    const raw = {
      id: 'test',
      name: 'Test',
      version: '1.0', // Not semver
      author: 'Test',
      description: 'Test',
      license: 'MIT',
      sdkVersion: '1.0.0',
      entrypoint: 'index.js',
      executionModel: 'native',
      permissions: []
    };
    expect(() => ManifestValidator.validate(raw)).toThrowError(/Invalid Plugin Manifest/);
  });

  it('should validate optional resource limits', () => {
    const raw = {
      id: 'test-limits',
      name: 'Test Limits',
      version: '1.0.0',
      author: 'Test',
      description: 'Test limits',
      license: 'MIT',
      sdkVersion: '1.0.0',
      entrypoint: 'index.js',
      executionModel: 'capability',
      permissions: [],
      limits: {
        timeoutMs: 5000,
        cpuLimitPercent: 50
      }
    };
    const valid = ManifestValidator.validate(raw);
    expect(valid.limits?.timeoutMs).toBe(5000);
  });
});
