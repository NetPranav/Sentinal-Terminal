/**
 * WorkflowBuilder.ts — Fluent Builder API for Programmatic Workflow Construction
 *
 * Supports full CRUD lifecycle: create, edit, delete, duplicate, clone.
 * Supports nested workflow invocation and typed output declarations.
 * Produces UserWorkflow objects ready for compilation or storage.
 */

import {
  UserWorkflow,
  WorkflowNode,
  WorkflowVariable,
  WorkflowOutput,
  WorkflowTrigger,
  WorkflowMetadata,
  ControlFlowType,
  ConditionExpression,
  TriggerType,
  VariableType,
} from '../models/WorkflowTypes';

export class WorkflowBuilder {
  private id: string;
  private name: string;
  private description: string;
  private author: string;
  private tags: string[];
  private category?: string;
  private variables: WorkflowVariable[] = [];
  private nodes: WorkflowNode[] = [];
  private outputs: WorkflowOutput[] = [];
  private triggers: WorkflowTrigger[] = [];
  private templateId?: string;

  constructor(name: string, author = 'user') {
    this.id = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.name = name;
    this.description = '';
    this.author = author;
    this.tags = [];
  }

  public setDescription(desc: string): this {
    this.description = desc;
    return this;
  }

  public setCategory(cat: string): this {
    this.category = cat;
    return this;
  }

  public addTag(tag: string): this {
    this.tags.push(tag);
    return this;
  }

  public fromTemplate(templateId: string): this {
    this.templateId = templateId;
    return this;
  }

  // ── Variable Declarations ──

  public addVariable(
    name: string,
    type: VariableType,
    description: string,
    required = true,
    defaultValue?: unknown
  ): this {
    this.variables.push({ name, type, description, required, defaultValue });
    return this;
  }

  // ── Node Construction ──

  public addAction(
    id: string,
    name: string,
    actionId: string,
    parameters: Record<string, unknown> = {},
    dependencies: string[] = []
  ): this {
    this.nodes.push({
      id, type: 'action', name, actionId, parameters, dependencies,
    });
    return this;
  }

  public addParallel(
    id: string,
    name: string,
    parallelNodeIds: string[],
    dependencies: string[] = []
  ): this {
    this.nodes.push({
      id, type: 'parallel', name, parallelNodeIds, dependencies,
    });
    return this;
  }

  public addConditional(
    id: string,
    name: string,
    condition: ConditionExpression,
    trueBranch: string[],
    falseBranch: string[] = [],
    dependencies: string[] = []
  ): this {
    this.nodes.push({
      id, type: 'conditional', name, condition, trueBranch, falseBranch, dependencies,
    });
    return this;
  }

  public addLoop(
    id: string,
    name: string,
    bodyNodeIds: string[],
    opts: { loopCount?: number; loopOverVariable?: string },
    dependencies: string[] = []
  ): this {
    this.nodes.push({
      id, type: 'loop', name,
      loopBodyNodeIds: bodyNodeIds,
      loopCount: opts.loopCount,
      loopOverVariable: opts.loopOverVariable,
      dependencies,
    });
    return this;
  }

  public addNestedWorkflow(
    id: string,
    name: string,
    nestedWorkflowId: string,
    inputBindings: Record<string, string> = {},
    dependencies: string[] = []
  ): this {
    this.nodes.push({
      id, type: 'nested_workflow', name, nestedWorkflowId,
      nestedInputBindings: inputBindings, dependencies,
    });
    return this;
  }

  public addWait(id: string, name: string, waitMs: number, dependencies: string[] = []): this {
    this.nodes.push({ id, type: 'wait', name, waitMs, dependencies });
    return this;
  }

  public addRetry(
    id: string,
    name: string,
    opts: { maxAttempts: number; delayMs: number; backoff?: boolean },
    dependencies: string[] = []
  ): this {
    this.nodes.push({
      id, type: 'retry', name,
      retryMaxAttempts: opts.maxAttempts,
      retryDelayMs: opts.delayMs,
      retryExponentialBackoff: opts.backoff || false,
      dependencies,
    });
    return this;
  }

  // ── Typed Outputs ──

  public addOutput(
    name: string,
    type: VariableType,
    description: string,
    sourceNodeId: string,
    sourceKey: string
  ): this {
    this.outputs.push({ name, type, description, sourceNodeId, sourceKey });
    return this;
  }

  // ── Triggers ──

  public addTrigger(type: TriggerType, config: Partial<WorkflowTrigger> = {}): this {
    this.triggers.push({ type, enabled: true, ...config } as WorkflowTrigger);
    return this;
  }

  // ── Build ──

  public build(): UserWorkflow {
    const now = Date.now();
    const metadata: WorkflowMetadata = {
      author: this.author,
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      tags: this.tags,
      description: this.description,
      category: this.category,
    };

    return {
      id: this.id,
      templateId: this.templateId,
      metadata,
      variables: [...this.variables],
      nodes: [...this.nodes],
      outputs: [...this.outputs],
      triggers: [...this.triggers],
      enabled: true,
      executionCount: 0,
    };
  }

  // ── CRUD Utilities ──

  public static duplicate(workflow: UserWorkflow, newName?: string): UserWorkflow {
    const now = Date.now();
    return {
      ...workflow,
      id: `wf-${now}-${Math.random().toString(36).substring(2, 6)}`,
      metadata: {
        ...workflow.metadata,
        createdAt: now,
        updatedAt: now,
        description: newName ? `Duplicate of ${workflow.metadata.description}` : workflow.metadata.description,
      },
      executionCount: 0,
      lastExecutedAt: undefined,
    };
  }

  public static clone(workflow: UserWorkflow): UserWorkflow {
    return JSON.parse(JSON.stringify(workflow));
  }
}
