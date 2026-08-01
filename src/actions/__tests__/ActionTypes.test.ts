import { describe, it, expect } from 'vitest';
import { ActionDefinitionSchema } from '../models/ActionTypes';
import { createMockAction } from './helpers';

describe('ActionTypes — Zod Schema Validation', () => {
  it('should accept a valid ActionDefinition', () => {
    const action = createMockAction({ id: 'filesystem.copy' });
    const result = ActionDefinitionSchema.safeParse(action);
    expect(result.success).toBe(true);
  });

  it('should reject an ActionDefinition with invalid ID format', () => {
    const action = createMockAction({ id: 'InvalidId' });
    const result = ActionDefinitionSchema.safeParse(action);
    expect(result.success).toBe(false);
  });

  it('should reject an ActionDefinition with empty displayName', () => {
    const action = createMockAction({ id: 'test.action', displayName: '' });
    const result = ActionDefinitionSchema.safeParse(action);
    expect(result.success).toBe(false);
  });

  it('should reject an ActionDefinition with no supported platforms', () => {
    const action = createMockAction({ id: 'test.action', supportedPlatforms: [] });
    const result = ActionDefinitionSchema.safeParse(action);
    expect(result.success).toBe(false);
  });

  it('should accept an ActionDefinition with full capabilities and constraints', () => {
    const action = createMockAction({
      id: 'filesystem.copy',
      capabilities: [
        { name: 'recursive', description: 'Recursive copy', enabledByDefault: true },
        { name: 'cross_device', description: 'Cross device copy', enabledByDefault: false },
      ],
      constraints: [
        { id: 'requires_existing_file', description: 'Source must exist', mandatory: true },
      ],
      outcomes: [
        { id: 'file_copied', description: 'File copied', stateKey: 'filesystem.file_exists', stateValue: true },
      ],
    });
    const result = ActionDefinitionSchema.safeParse(action);
    expect(result.success).toBe(true);
  });

  it('should accept an ActionDefinition with inputs and outputs', () => {
    const action = createMockAction({
      id: 'filesystem.copy',
      inputs: [
        { name: 'source', type: 'string', description: 'Source path', required: true },
        { name: 'destination', type: 'string', description: 'Destination path', required: true },
        { name: 'recursive', type: 'boolean', description: 'Copy recursively', required: false, defaultValue: false },
      ],
      outputs: [
        { name: 'copiedPath', type: 'string', description: 'Path of the copied file' },
      ],
    });
    const result = ActionDefinitionSchema.safeParse(action);
    expect(result.success).toBe(true);
  });

  it('should reject negative timeoutMs', () => {
    const action = createMockAction({ id: 'test.action', timeoutMs: -1 });
    const result = ActionDefinitionSchema.safeParse(action);
    expect(result.success).toBe(false);
  });
});
