/**
 * WorkflowRegistry.ts — Unified Workflow Discovery & Lookup Layer
 *
 * Separates discovery (Registry) from persistence (Storage).
 * Aggregates templates, installed user workflows, plugin workflows, and shared workflows.
 */

import { WorkflowTemplate, UserWorkflow } from '../models/WorkflowTypes';
import { builtinTemplates } from '../templates/WorkflowTemplates';

export class WorkflowRegistry {
  private templates: Map<string, WorkflowTemplate> = new Map();
  private userWorkflows: Map<string, UserWorkflow> = new Map();
  private pluginWorkflows: Map<string, UserWorkflow> = new Map();

  constructor(loadBuiltins = true) {
    if (loadBuiltins) {
      for (const tpl of builtinTemplates) {
        this.templates.set(tpl.id, tpl);
      }
    }
  }

  // ── Template Operations ──

  public registerTemplate(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
  }

  public getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  public getAllTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Instantiate a UserWorkflow from an immutable template.
   */
  public instantiateFromTemplate(templateId: string, author = 'user'): UserWorkflow | undefined {
    const tpl = this.templates.get(templateId);
    if (!tpl) return undefined;

    const now = Date.now();
    return {
      id: `wf-${now}-${Math.random().toString(36).substring(2, 6)}`,
      templateId: tpl.id,
      metadata: {
        ...tpl.metadata,
        author,
        createdAt: now,
        updatedAt: now,
      },
      variables: [...tpl.variables],
      nodes: [...tpl.nodes],
      outputs: [...tpl.outputs],
      triggers: [...tpl.triggers],
      enabled: true,
      executionCount: 0,
    };
  }

  // ── User Workflow Operations ──

  public registerUserWorkflow(workflow: UserWorkflow): void {
    this.userWorkflows.set(workflow.id, workflow);
  }

  public getUserWorkflow(id: string): UserWorkflow | undefined {
    return this.userWorkflows.get(id);
  }

  public getAllUserWorkflows(): UserWorkflow[] {
    return Array.from(this.userWorkflows.values());
  }

  public removeUserWorkflow(id: string): boolean {
    return this.userWorkflows.delete(id);
  }

  // ── Plugin Workflows ──

  public registerPluginWorkflow(workflow: UserWorkflow): void {
    this.pluginWorkflows.set(workflow.id, workflow);
  }

  public getAllPluginWorkflows(): UserWorkflow[] {
    return Array.from(this.pluginWorkflows.values());
  }

  // ── Universal Lookup ──

  /**
   * Lookup any workflow by ID across all registries (user → plugin → template instantiation).
   * Used by nested workflow resolution during IR compilation.
   */
  public lookup(id: string): UserWorkflow | undefined {
    return this.userWorkflows.get(id) || this.pluginWorkflows.get(id);
  }

  /**
   * Search workflows by tag, category, or name substring across all registries.
   */
  public search(query: string): Array<{ type: 'template' | 'user' | 'plugin'; id: string; name: string }> {
    const q = query.toLowerCase();
    const results: Array<{ type: 'template' | 'user' | 'plugin'; id: string; name: string }> = [];

    for (const tpl of this.templates.values()) {
      if (
        tpl.metadata.description.toLowerCase().includes(q) ||
        tpl.metadata.tags.some(t => t.toLowerCase().includes(q)) ||
        tpl.id.toLowerCase().includes(q)
      ) {
        results.push({ type: 'template', id: tpl.id, name: tpl.metadata.description });
      }
    }

    for (const wf of this.userWorkflows.values()) {
      if (
        wf.metadata.description.toLowerCase().includes(q) ||
        wf.metadata.tags.some(t => t.toLowerCase().includes(q)) ||
        wf.id.toLowerCase().includes(q)
      ) {
        results.push({ type: 'user', id: wf.id, name: wf.metadata.description });
      }
    }

    for (const wf of this.pluginWorkflows.values()) {
      if (wf.metadata.description.toLowerCase().includes(q) || wf.id.toLowerCase().includes(q)) {
        results.push({ type: 'plugin', id: wf.id, name: wf.metadata.description });
      }
    }

    return results;
  }

  public clear(): void {
    this.templates.clear();
    this.userWorkflows.clear();
    this.pluginWorkflows.clear();
  }
}

export const globalWorkflowRegistry = new WorkflowRegistry();
