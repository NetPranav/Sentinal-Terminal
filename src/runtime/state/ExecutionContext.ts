/**
 * ExecutionContext.ts — Shared session memory
 *
 * Stores action outputs, temporary variables, shared entities,
 * and runtime metadata. Later ActionNodes consume prior outputs
 * through this context rather than re-querying the OS.
 */

import { IExecutionContext, ExecutionContextSnapshot } from '../models/RuntimeTypes';

export class ExecutionContext implements IExecutionContext {
  private outputs: Map<string, Record<string, unknown>> = new Map();
  private variables: Map<string, unknown> = new Map();
  private entities: Map<string, string> = new Map();

  public setOutput(actionNodeId: string, key: string, value: unknown): void {
    const nodeOutputs = this.outputs.get(actionNodeId) || {};
    nodeOutputs[key] = value;
    this.outputs.set(actionNodeId, nodeOutputs);
  }

  public getOutput(actionNodeId: string, key: string): unknown | undefined {
    return this.outputs.get(actionNodeId)?.[key];
  }

  public getNodeOutputs(actionNodeId: string): Record<string, unknown> {
    return this.outputs.get(actionNodeId) || {};
  }

  public setVariable(key: string, value: unknown): void {
    this.variables.set(key, value);
  }

  public getVariable(key: string): unknown | undefined {
    return this.variables.get(key);
  }

  public setEntity(type: string, value: string): void {
    this.entities.set(type, value);
  }

  public getEntity(type: string): string | undefined {
    return this.entities.get(type);
  }

  public export(): ExecutionContextSnapshot {
    const outputs: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of this.outputs) outputs[k] = { ...v };

    const variables: Record<string, unknown> = {};
    for (const [k, v] of this.variables) variables[k] = v;

    const entities: Record<string, string> = {};
    for (const [k, v] of this.entities) entities[k] = v;

    return { outputs, variables, entities };
  }

  public restore(snapshot: ExecutionContextSnapshot): void {
    this.outputs.clear();
    this.variables.clear();
    this.entities.clear();

    for (const [k, v] of Object.entries(snapshot.outputs)) {
      this.outputs.set(k, { ...v });
    }
    for (const [k, v] of Object.entries(snapshot.variables)) {
      this.variables.set(k, v);
    }
    for (const [k, v] of Object.entries(snapshot.entities)) {
      this.entities.set(k, v);
    }
  }
}
