import { describe, it, expect, vi } from 'vitest';
import { CapabilityManager, CapabilityRegistry, Capability, CapabilityResult } from './Capability';
import { z } from 'zod';

class MockCapability implements Capability<string, string> {
  inputSchema: any = z.string();
  supportsDryRun = false;
  metadata = {
    id: 'mock.echo',
    name: 'Echo',
    description: 'Echoes the input',
    category: 'Other' as const,
    supportedPlatforms: ['macos'] as any,
    requiredPermissions: [],
    version: '1.0.0'
  };

  async execute(input: string): Promise<CapabilityResult<string>> {
    if (input === 'error') {
      throw new Error("Mock error");
    }
    return { success: true, data: input };
  }
}

describe('CapabilityManager', () => {
  it('should register and execute a capability', async () => {
    const registry = CapabilityRegistry.getInstance();
    const manager = CapabilityManager.getInstance();
    
    registry.register(new MockCapability());
    
    const result = await manager.execute<string, string>('mock.echo', 'hello');
    
    expect(result.success).toBe(true);
    expect(result.data).toBe('hello');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle capability errors gracefully', async () => {
    const manager = CapabilityManager.getInstance();
    const result = await manager.execute<string, string>('mock.echo', 'error');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Mock error');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should return error for unknown capability', async () => {
    const manager = CapabilityManager.getInstance();
    const result = await manager.execute<string, string>('unknown', '');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
