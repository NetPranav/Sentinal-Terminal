/**
 * ActionLoader.ts — Reads and validates tool.json files into ActionDefinitions
 *
 * Adapts the legacy tool.json format into the enriched ActionDefinition schema.
 * Rejects duplicates and invalid schemas.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ActionDefinition,
  ActionDefinitionSchema,
  ActionInput,
  ActionCost,
  RetryPolicy,
} from '../models/ActionTypes';

export interface LoadResult {
  actions: ActionDefinition[];
  errors: { file: string; error: string }[];
  loadTimeMs: number;
}

export class ActionLoader {
  /**
   * Loads all tool.json files from the given root directory.
   * Walks subdirectories recursively looking for tool.json files.
   */
  public async loadFromDirectory(rootDir: string): Promise<LoadResult> {
    const start = performance.now();
    const actions: ActionDefinition[] = [];
    const errors: { file: string; error: string }[] = [];
    const seenIds = new Set<string>();

    const toolFiles = this.findToolFiles(rootDir);

    for (const filePath of toolFiles) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const adapted = this.adaptLegacyTool(parsed, filePath);

        // Validate against schema
        const result = ActionDefinitionSchema.safeParse(adapted);
        if (!result.success) {
          const issues = 'error' in result ? String(result.error) : 'Schema validation failed';
          errors.push({ file: filePath, error: issues });
          continue;
        }

        // Reject duplicates
        if (seenIds.has(adapted.id)) {
          errors.push({ file: filePath, error: `Duplicate action ID: ${adapted.id}` });
          continue;
        }

        seenIds.add(adapted.id);
        actions.push(adapted);
      } catch (err: any) {
        errors.push({ file: filePath, error: err.message || String(err) });
      }
    }

    return {
      actions,
      errors,
      loadTimeMs: performance.now() - start,
    };
  }

  /**
   * Loads a single ActionDefinition from a raw JSON object (for testing/programmatic use).
   */
  public loadFromObject(obj: Record<string, unknown>): ActionDefinition {
    const adapted = this.adaptLegacyTool(obj, '<inline>');
    const result = ActionDefinitionSchema.safeParse(adapted);
    if (!result.success) {
      throw new Error(`Invalid ActionDefinition: ${'error' in result ? String(result.error) : 'validation failed'}`);
    }
    return adapted;
  }

  private findToolFiles(dir: string): string[] {
    const results: string[] = [];

    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.findToolFiles(fullPath));
      } else if (entry.name === 'tool.json') {
        results.push(fullPath);
      }
    }

    return results;
  }

  /**
   * Maps the legacy tool.json format to the new enriched ActionDefinition.
   * Fills missing fields with sensible defaults.
   */
  private adaptLegacyTool(raw: any, filePath: string): ActionDefinition {
    // Map legacy parameters to ActionInput[]
    const inputs: ActionInput[] = [];
    if (Array.isArray(raw.parameters)) {
      for (const p of raw.parameters) {
        inputs.push({
          name: p.name || '',
          type: p.type || 'string',
          description: p.description || '',
          required: p.required !== false,
        });
      }
    }
    if (Array.isArray(raw.optionalParameters)) {
      for (const p of raw.optionalParameters) {
        inputs.push({
          name: p.name || '',
          type: p.type || 'string',
          description: p.description || '',
          required: false,
        });
      }
    }

    // Map legacy securityRisk to RiskLevel
    const riskMap: Record<string, 'safe' | 'low' | 'medium' | 'high' | 'critical'> = {
      SAFE: 'safe',
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical',
    };
    const riskLevel = riskMap[raw.securityRisk?.toUpperCase()] || 'low';

    const cost: ActionCost = {
      estimatedLatency: raw.estimatedExecutionTime || '1s',
      resourceUsage: 'low',
      riskLevel,
      permissionCost: Array.isArray(raw.requiredPermissions) ? raw.requiredPermissions.length : 0,
      recoveryComplexity: raw.rollbackAvailable ? 'low' : 'medium',
    };

    const retryPolicy: RetryPolicy = {
      maxRetries: 1,
      delayMs: 500,
      exponentialBackoff: false,
    };

    return {
      id: raw.id || '',
      displayName: raw.displayName || raw.id || '',
      version: raw.version || '1.0.0',
      summary: raw.description || '',
      shortDescription: raw.description || '',
      detailedDescription: raw.description || '',
      safetyNotes: '',
      category: raw.category || raw.domain || '',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      aliases: Array.isArray(raw.aliases) ? raw.aliases : [],
      supportedPlatforms: Array.isArray(raw.supportedPlatforms) ? raw.supportedPlatforms : ['macos'],
      requiredPermissions: Array.isArray(raw.requiredPermissions) ? raw.requiredPermissions : [],
      inputs,
      outputs: [],
      requiredEntities: [],
      optionalEntities: [],
      capabilities: [],
      constraints: [],
      preconditions: [],
      postconditions: [],
      sideEffects: [],
      outcomes: [],
      requiredSystemState: [],
      producedSystemState: [],
      cost,
      failureScenarios: [],
      recoveryHints: [],
      rollbackSupported: raw.rollbackAvailable === true,
      retryPolicy,
      timeoutMs: 30000,
      examples: [],
    };
  }
}
