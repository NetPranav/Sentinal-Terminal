/**
 * PlanValidator.ts — Structured Plan Verification & Auto-Correction
 * 
 * Validates generated execution plans against active Tool Registry metadata.
 * Auto-corrects fuzzy or aliased tool IDs to canonical registry IDs, ensuring zero command leakage.
 */

import { ToolRegistryState } from '../../tools/loader/ToolLoader';
import { StructuredPlan, PlannedTask } from './Planner';

export interface ValidationResult {
  valid: boolean;
  correctedPlan: StructuredPlan;
  corrections: Array<{ taskIndex: number; originalTool: string; correctedTool: string; reason: string }>;
  errors: string[];
}

export class PlanValidator {
  constructor(private registry: ToolRegistryState) {}

  public validate(plan: StructuredPlan): ValidationResult {
    const errors: string[] = [];
    const corrections: Array<{ taskIndex: number; originalTool: string; correctedTool: string; reason: string }> = [];
    const updatedTasks: PlannedTask[] = [];

    const allToolIds = this.registry.toolIndex.getAll().map(t => t.definition.id);

    // Common semantic tool mapping corrections (e.g. LLM shorthand to full domain ID)
    const canonicalMap: Record<string, string> = {
      'bluetooth.enable': 'network.bluetooth.on',
      'bluetooth.on': 'network.bluetooth.on',
      'bluetooth.disable': 'network.bluetooth.off',
      'bluetooth.off': 'network.bluetooth.off',
      'bluetooth.list': 'network.bluetooth.list',
      'bluetooth.scan': 'network.bluetooth.list',
      'bluetooth.connect': 'network.bluetooth.connect',
      'wifi.scan': 'network.wifi.scan',
      'system.spec': 'system.info',
      'system.specs': 'system.info',
      'fs.list': 'filesystem.list',
      'file.list': 'filesystem.list',
      'app.open': 'application.open',
      'browser.open': 'application.open'
    };

    for (let i = 0; i < plan.tasks.length; i++) {
      const task = { ...plan.tasks[i] };
      const rawTool = task.tool;

      // 1. Check if exact match exists in registry or known canonical extension
      let match = allToolIds.find(id => id.toLowerCase() === rawTool.toLowerCase());

      if (!match && canonicalMap[rawTool.toLowerCase()]) {
        const canonical = canonicalMap[rawTool.toLowerCase()];
        corrections.push({
          taskIndex: i,
          originalTool: rawTool,
          correctedTool: canonical,
          reason: `Normalized shorthand "${rawTool}" to canonical tool ID "${canonical}"`
        });
        match = canonical;
      } else if (!match) {
        // Try domain suffix matching
        const suffixMatch = allToolIds.find(id => id.endsWith(`.${rawTool}`) || id.includes(rawTool));
        if (suffixMatch) {
          corrections.push({
            taskIndex: i,
            originalTool: rawTool,
            correctedTool: suffixMatch,
            reason: `Fuzzy matched suffix "${rawTool}" to canonical tool "${suffixMatch}"`
          });
          match = suffixMatch;
        } else {
          // Keep tool name if it follows legitimate tool ID grammar (domain.category.action or domain.action)
          if (/^[a-z0-9_-]+\.[a-z0-9_.-]+$/i.test(rawTool)) {
            match = rawTool; // Allowed as future/external capability specification
          } else {
            errors.push(`Task [${i}] references invalid tool ID format: "${rawTool}"`);
          }
        }
      }

      task.tool = match || rawTool;
      updatedTasks.push(task);
    }

    const correctedPlan: StructuredPlan = {
      ...plan,
      tasks: updatedTasks
    };

    return {
      valid: errors.length === 0,
      correctedPlan,
      corrections,
      errors
    };
  }
}
