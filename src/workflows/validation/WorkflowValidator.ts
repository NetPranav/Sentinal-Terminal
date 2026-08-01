/**
 * WorkflowValidator.ts — Structural & Semantic Workflow Validation
 *
 * Validates variable declarations, graph topology, dependency ordering,
 * missing inputs, circular reference detection, and nested workflow resolution.
 */

import { UserWorkflow, WorkflowNode } from '../models/WorkflowTypes';
import { VariableResolver } from '../variables/WorkflowVariables';

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

export class WorkflowValidator {
  private variableResolver: VariableResolver;

  constructor() {
    this.variableResolver = new VariableResolver();
  }

  /**
   * Perform comprehensive structural and semantic validation.
   */
  public validate(
    workflow: UserWorkflow,
    knownWorkflowIds: string[] = []
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate metadata
    if (!workflow.id) errors.push('Workflow ID is required.');
    if (!workflow.metadata.version) errors.push('Workflow version is required.');

    // 2. Validate nodes exist
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow must contain at least one node.');
    }

    // 3. Validate node IDs are unique
    const nodeIds = new Set<string>();
    for (const node of workflow.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: '${node.id}'`);
      }
      nodeIds.add(node.id);
    }

    // 4. Validate dependencies reference existing nodes
    for (const node of workflow.nodes) {
      for (const depId of node.dependencies) {
        if (!nodeIds.has(depId)) {
          errors.push(`Node '${node.id}' depends on non-existent node '${depId}'`);
        }
      }
    }

    // 5. Check for circular references
    const circularCheck = this.detectCircularDependencies(workflow.nodes);
    if (circularCheck) {
      errors.push(`Circular dependency detected: ${circularCheck}`);
    }

    // 6. Validate action nodes have actionIds
    for (const node of workflow.nodes) {
      if (node.type === 'action' && !node.actionId) {
        errors.push(`Action node '${node.id}' is missing an actionId.`);
      }
    }

    // 7. Validate nested workflow references
    for (const node of workflow.nodes) {
      if (node.type === 'nested_workflow') {
        if (!node.nestedWorkflowId) {
          errors.push(`Nested workflow node '${node.id}' is missing a nestedWorkflowId.`);
        } else if (node.nestedWorkflowId === workflow.id) {
          errors.push(`Nested workflow node '${node.id}' creates self-referential cycle with workflow '${workflow.id}'.`);
        } else if (knownWorkflowIds.length > 0 && !knownWorkflowIds.includes(node.nestedWorkflowId)) {
          warnings.push(`Nested workflow '${node.nestedWorkflowId}' referenced by node '${node.id}' not found in registry.`);
        }
      }
    }

    // 8. Validate loop nodes have body references
    for (const node of workflow.nodes) {
      if (node.type === 'loop') {
        if (!node.loopBodyNodeIds || node.loopBodyNodeIds.length === 0) {
          errors.push(`Loop node '${node.id}' has no body nodes defined.`);
        }
        if (node.loopCount === undefined && !node.loopOverVariable) {
          errors.push(`Loop node '${node.id}' requires either loopCount or loopOverVariable.`);
        }
      }
    }

    // 9. Validate conditional nodes
    for (const node of workflow.nodes) {
      if (node.type === 'conditional' && !node.condition) {
        errors.push(`Conditional node '${node.id}' is missing a condition expression.`);
      }
    }

    // 10. Validate outputs reference existing nodes
    for (const output of workflow.outputs) {
      if (!nodeIds.has(output.sourceNodeId)) {
        errors.push(`Output '${output.name}' references non-existent node '${output.sourceNodeId}'.`);
      }
    }

    // 11. Variable declarations validation
    for (const variable of workflow.variables) {
      if (!variable.name) errors.push('Variable name is required.');
      if (!variable.type) errors.push(`Variable '${variable.name}' type is required.`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private detectCircularDependencies(nodes: readonly WorkflowNode[]): string | null {
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
      adjacency.set(node.id, [...node.dependencies]);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string, path: string[]): string | null => {
      if (recursionStack.has(nodeId)) {
        return [...path, nodeId].join(' → ');
      }
      if (visited.has(nodeId)) return null;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const deps = adjacency.get(nodeId) || [];
      for (const dep of deps) {
        const result = hasCycle(dep, [...path, nodeId]);
        if (result) return result;
      }

      recursionStack.delete(nodeId);
      return null;
    };

    for (const node of nodes) {
      const result = hasCycle(node.id, []);
      if (result) return result;
    }

    return null;
  }
}

export const globalWorkflowValidator = new WorkflowValidator();
