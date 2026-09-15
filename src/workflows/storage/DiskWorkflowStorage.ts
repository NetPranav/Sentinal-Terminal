/**
 * DiskWorkflowStorage.ts — Schema-Versioned File Persistence for Saved Workflows
 *
 * Persists and loads workflows to/from `~/.sentinel/workflows/<name>.json`.
 * Enforces `schemaVersion: 1`, provides automatic legacy migration, and guards
 * against unsupported future schema versions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { invoke } from '@tauri-apps/api/core';
import {
  SavedWorkflowDefinition,
  WorkflowStepDefinition,
  CURRENT_WORKFLOW_SCHEMA_VERSION
} from '../models/WorkflowTypes';

export class DiskWorkflowStorage {
  private static instance?: DiskWorkflowStorage;
  private customBaseDir?: string;

  public static getInstance(): DiskWorkflowStorage {
    if (!DiskWorkflowStorage.instance) {
      DiskWorkflowStorage.instance = new DiskWorkflowStorage();
    }
    return DiskWorkflowStorage.instance;
  }

  constructor(customBaseDir?: string) {
    this.customBaseDir = customBaseDir;
  }

  public setCustomBaseDir(customBaseDir?: string): void {
    this.customBaseDir = customBaseDir;
  }

  /**
   * Get the directory where workflows are stored (~/.sentinel/workflows)
   */
  public getWorkflowsDir(): string {
    if (this.customBaseDir) {
      return this.customBaseDir;
    }
    const home = (typeof process !== 'undefined' && process.env && (process.env.HOME || process.env.USERPROFILE)) || '~';
    return path.join(home, '.sentinel', 'workflows');
  }

  /**
   * Resolve full path to a workflow JSON file given its name.
   */
  public getWorkflowFilePath(name: string): string {
    const cleanName = name.replace(/[^a-zA-Z0-9_.-]/g, '_').toLowerCase();
    return path.join(this.getWorkflowsDir(), `${cleanName}.json`);
  }

  /**
   * Convert path to a shell-safe path expanding ~/ to $HOME/ inside quotes
   */
  public toShellPath(p: string): string {
    if (p.startsWith('~/') || p.startsWith('~\\')) {
      return `"$HOME/${p.slice(2).replace(/\\/g, '/')}"`;
    }
    if (p === '~') {
      return '"$HOME"';
    }
    return `"${p}"`;
  }

  /**
   * Ensure ~/.sentinel/workflows directory exists.
   */
  private async ensureDirExists(): Promise<void> {
    const dir = this.getWorkflowsDir();
    try {
      if (fs && fs.mkdirSync) {
        fs.mkdirSync(dir, { recursive: true });
        return;
      }
    } catch {
      // Fallback
    }

    try {
      const { mkdir, exists } = await import('@tauri-apps/plugin-fs');
      if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true });
        return;
      }
    } catch {
      // Fallback
    }

    try {
      await invoke('execute_command', {
        command: 'sh',
        args: ['-c', `mkdir -p ${this.toShellPath(dir)}`]
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Save a workflow definition to disk with schema version 1.
   */
  public async saveWorkflow(workflow: SavedWorkflowDefinition): Promise<string> {
    await this.ensureDirExists();
    const filePath = this.getWorkflowFilePath(workflow.name);

    // Enforce schema version
    const versionedWorkflow: SavedWorkflowDefinition = {
      ...workflow,
      schemaVersion: workflow.schemaVersion || CURRENT_WORKFLOW_SCHEMA_VERSION,
      updatedAt: Date.now()
    };

    const content = JSON.stringify(versionedWorkflow, null, 2);

    try {
      if (fs && fs.writeFileSync) {
        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
      }
    } catch {
      // Fallback
    }

    // Try Tauri plugin-fs directly
    try {
      const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
      const parentDir = path.dirname(filePath);
      if (!(await exists(parentDir))) {
        await mkdir(parentDir, { recursive: true });
      }
      await writeTextFile(filePath, content);
      return filePath;
    } catch {
      // Fallback
    }

    // Tauri shell fallback: Use base64 decode to guarantee exact bytes without quote/newline escaping bugs
    const b64 = typeof btoa === 'function' 
      ? btoa(unescape(encodeURIComponent(content))) 
      : Buffer.from(content, 'utf8').toString('base64');

    await invoke('execute_command', {
      command: 'sh',
      args: ['-c', `mkdir -p "$(dirname ${this.toShellPath(filePath)})" && echo "${b64}" | base64 -d > ${this.toShellPath(filePath)}`]
    });

    return filePath;
  }

  /**
   * Load a workflow definition from disk by name.
   * Performs schema validation and automatic migration of legacy formats.
   */
  public async loadWorkflow(name: string): Promise<SavedWorkflowDefinition | null> {
    const filePath = this.getWorkflowFilePath(name);

    let rawJson: string | null = null;
    try {
      if (fs && fs.existsSync && fs.existsSync(filePath)) {
        rawJson = fs.readFileSync(filePath, 'utf8');
      }
    } catch {
      rawJson = null;
    }

    if (!rawJson) {
      try {
        const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
        if (await exists(filePath)) {
          rawJson = await readTextFile(filePath);
        }
      } catch {
        // Fallback
      }
    }

    if (!rawJson) {
      try {
        const res = await invoke<{ stdout: string; code: number }>('execute_command', {
          command: 'sh',
          args: ['-c', `cat ${this.toShellPath(filePath)} 2>/dev/null`]
        });
        if (res.code === 0 && res.stdout.trim()) {
          rawJson = res.stdout;
        }
      } catch {
        return null;
      }
    }

    if (!rawJson) {
      return null;
    }

    return this.parseAndMigrate(rawJson, name);
  }

  /**
   * Parse JSON and migrate if schemaVersion is missing or outdated.
   */
  public parseAndMigrate(rawJson: string, defaultName?: string): SavedWorkflowDefinition {
    const raw = JSON.parse(rawJson);

    // Check for future unsupported schema
    if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > CURRENT_WORKFLOW_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported workflow schema version ${raw.schemaVersion} for workflow "${raw.name}". Sentinel supports up to version ${CURRENT_WORKFLOW_SCHEMA_VERSION}.`
      );
    }

    // If already compliant with schemaVersion 1
    if (raw.schemaVersion === CURRENT_WORKFLOW_SCHEMA_VERSION && Array.isArray(raw.steps)) {
      // Ensure all steps conform to WorkflowStepDefinition
      const validatedSteps: WorkflowStepDefinition[] = raw.steps.map((s: any, idx: number) => {
        if (typeof s === 'string') {
          return {
            id: `step-${idx + 1}`,
            name: `Step ${idx + 1}`,
            command: s
          };
        }
        return {
          id: s.id || `step-${idx + 1}`,
          name: s.name || `Step ${idx + 1}`,
          command: s.command || '',
          cwd: s.cwd,
          timeoutMs: s.timeoutMs,
          expectedExitCode: s.expectedExitCode,
          validationCriteria: s.validationCriteria,
          dependsOn: s.dependsOn,
          isDestructive: s.isDestructive
        };
      });

      return {
        schemaVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
        name: raw.name || defaultName || 'unnamed-workflow',
        description: raw.description,
        steps: validatedSteps,
        parameters: raw.parameters || [],
        environmentPrerequisites: raw.environmentPrerequisites,
        createdAt: raw.createdAt || Date.now(),
        updatedAt: raw.updatedAt || Date.now(),
        author: raw.author,
        tags: raw.tags || []
      };
    }

    // Auto-migration from legacy unversioned structure (e.g. { name: "foo", steps: ["git status", "npm test"] })
    const migratedSteps: WorkflowStepDefinition[] = Array.isArray(raw.steps)
      ? raw.steps.map((s: any, idx: number) => ({
          id: `step-${idx + 1}`,
          name: typeof s === 'object' && s.name ? s.name : `Step ${idx + 1}`,
          command: typeof s === 'string' ? s : s.command || ''
        }))
      : [];

    return {
      schemaVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      name: raw.name || defaultName || 'unnamed-workflow',
      description: raw.description || 'Migrated from legacy unversioned workflow',
      steps: migratedSteps,
      parameters: [],
      createdAt: raw.createdAt || Date.now(),
      updatedAt: Date.now(),
      tags: ['migrated']
    };
  }

  /**
   * Check if a workflow exists.
   */
  public async hasWorkflow(name: string): Promise<boolean> {
    const filePath = this.getWorkflowFilePath(name);
    try {
      if (fs && fs.existsSync) {
        return fs.existsSync(filePath);
      }
    } catch {
      // ignore
    }

    try {
      const { exists } = await import('@tauri-apps/plugin-fs');
      if (await exists(filePath)) {
        return true;
      }
    } catch {
      // ignore
    }

    try {
      const res = await invoke<{ code: number }>('execute_command', {
        command: 'sh',
        args: ['-c', `test -f ${this.toShellPath(filePath)}`]
      });
      return res.code === 0;
    } catch {
      return false;
    }
  }

  /**
   * List all saved workflows.
   */
  public async listWorkflows(): Promise<SavedWorkflowDefinition[]> {
    await this.ensureDirExists();
    const dir = this.getWorkflowsDir();

    let files: string[] = [];
    try {
      if (fs && fs.readdirSync) {
        files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      }
    } catch {
      // Fallback
    }

    if (files.length === 0) {
      try {
        const { readDir, exists } = await import('@tauri-apps/plugin-fs');
        if (await exists(dir)) {
          const entries = await readDir(dir);
          files = entries
            .filter(e => e.isFile && (e.name || '').endsWith('.json'))
            .map(e => e.name as string);
        }
      } catch {
        // Fallback
      }
    }

    if (files.length === 0) {
      try {
        const res = await invoke<{ stdout: string }>('execute_command', {
          command: 'sh',
          args: ['-c', `ls -1 ${this.toShellPath(dir)}/*.json 2>/dev/null`]
        });
        if (res.stdout.trim()) {
          files = res.stdout
            .trim()
            .split('\n')
            .map(p => path.basename(p.trim()));
        }
      } catch {
        return [];
      }
    }

    const results: SavedWorkflowDefinition[] = [];
    for (const file of files) {
      const name = file.replace(/\.json$/i, '');
      const wf = await this.loadWorkflow(name);
      if (wf) {
        results.push(wf);
      }
    }

    return results;
  }

  /**
   * Delete a saved workflow by name.
   */
  public async deleteWorkflow(name: string): Promise<boolean> {
    const filePath = this.getWorkflowFilePath(name);
    try {
      if (fs && fs.existsSync && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch {
      // ignore
    }

    try {
      const { remove, exists } = await import('@tauri-apps/plugin-fs');
      if (await exists(filePath)) {
        await remove(filePath);
        return true;
      }
    } catch {
      // ignore
    }

    try {
      const res = await invoke<{ code: number }>('execute_command', {
        command: 'sh',
        args: ['-c', `rm -f ${this.toShellPath(filePath)}`]
      });
      return res.code === 0;
    } catch {
      return false;
    }
  }
}
