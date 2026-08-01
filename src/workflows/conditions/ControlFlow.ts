/**
 * ControlFlow.ts — 9 Control Flow Primitives for Workflow Composition
 *
 * Each primitive is a composable node type resolved by the Workflow IR Compiler
 * into flattened ActionGraph topology. Control flow nodes are NOT ActionDefinitions —
 * they are structural directives that shape execution ordering.
 */

import { WorkflowNode, ConditionExpression } from '../models/WorkflowTypes';

/**
 * Evaluate a condition expression against resolved runtime variables.
 */
export function evaluateCondition(
  condition: ConditionExpression,
  resolvedVariables: Record<string, unknown>
): boolean {
  const actualValue = resolvedVariables[condition.variable];

  switch (condition.operator) {
    case '==':
      return actualValue === condition.value;
    case '!=':
      return actualValue !== condition.value;
    case '>':
      return Number(actualValue) > Number(condition.value);
    case '<':
      return Number(actualValue) < Number(condition.value);
    case '>=':
      return Number(actualValue) >= Number(condition.value);
    case '<=':
      return Number(actualValue) <= Number(condition.value);
    case 'exists':
      return actualValue !== undefined && actualValue !== null;
    case 'not_exists':
      return actualValue === undefined || actualValue === null;
    case 'contains':
      if (typeof actualValue === 'string') return actualValue.includes(String(condition.value));
      if (Array.isArray(actualValue)) return actualValue.includes(condition.value);
      return false;
    case 'matches':
      if (typeof actualValue === 'string' && typeof condition.value === 'string') {
        return new RegExp(condition.value).test(actualValue);
      }
      return false;
    default:
      return false;
  }
}

/**
 * Determine if a WorkflowNode is a control flow structural directive (not a direct action).
 */
export function isControlFlowNode(node: WorkflowNode): boolean {
  return [
    'sequential', 'parallel', 'conditional', 'switch',
    'loop', 'retry', 'wait', 'timeout', 'early_exit',
  ].includes(node.type);
}

/**
 * Determine if a WorkflowNode references a nested workflow.
 */
export function isNestedWorkflowNode(node: WorkflowNode): boolean {
  return node.type === 'nested_workflow' && !!node.nestedWorkflowId;
}

/**
 * Determine if a WorkflowNode is a directly compilable action reference.
 */
export function isActionNode(node: WorkflowNode): boolean {
  return node.type === 'action' && !!node.actionId;
}
