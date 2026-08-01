/**
 * ManifestValidator.ts — Enforces PluginManifest integrity via Zod
 */

import { z } from 'zod';
import { PluginManifest } from '../models/PluginTypes';

export const ResourceLimitsSchema = z.object({
  memoryLimitMb: z.number().positive().optional(),
  cpuLimitPercent: z.number().min(1).max(100).optional(),
  timeoutMs: z.number().positive().optional(),
  maxThreads: z.number().int().positive().optional(),
  maxProcesses: z.number().int().positive().optional(),
});

export const PluginManifestSchema = z.object({
  id: z.string().min(3).regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/, 'ID must be lowercase alphanumeric with dots or dashes'),
  name: z.string().min(2),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semantic (x.y.z)'),
  author: z.string().min(2),
  description: z.string(),
  license: z.string(),
  sdkVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'SDK Version must be semantic (x.y.z)'),
  entrypoint: z.string().endsWith('.js'),
  executionModel: z.enum(['capability', 'workflow', 'ui', 'native']),
  permissions: z.array(z.string().regex(/^[a-z]+\.[a-z]+$/, 'Permissions must follow category.action format (e.g. filesystem.read)')),
  dependencies: z.record(z.string(), z.string()).optional(),
  limits: ResourceLimitsSchema.optional(),
  checksum: z.string().optional(),
  signature: z.string().optional(),
});

export class ManifestValidator {
  /**
   * Validates a raw JSON object against the PluginManifest schema.
   * Throws an error with detailed messages if invalid.
   */
  public static validate(rawManifest: unknown): PluginManifest {
    const result = PluginManifestSchema.safeParse(rawManifest);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Invalid Plugin Manifest: ${issues}`);
    }
    return result.data as PluginManifest;
  }
}
