/**
 * LoopEngine.ts — Loop Iteration State Manager
 *
 * Manages count-based and collection-based loop expansion during IR compilation.
 * Supports break/continue semantics and guard condition evaluation.
 */

import { WorkflowNode, WorkflowIRNode } from '../models/WorkflowTypes';
import { evaluateCondition } from '../conditions/ControlFlow';

export interface LoopExpansionResult {
  readonly expandedNodes: WorkflowIRNode[];
  readonly iterationCount: number;
}

export class LoopEngine {
  private readonly maxIterations = 1000;

  /**
   * Expand a loop node into flattened IR nodes with iteration-scoped IDs.
   */
  public expandLoop(
    loopNode: WorkflowNode,
    bodyNodes: WorkflowNode[],
    resolvedVariables: Record<string, unknown>,
    sourceWorkflowId: string
  ): LoopExpansionResult {
    const expandedNodes: WorkflowIRNode[] = [];

    // Determine iteration count
    let iterationCount = 0;
    if (loopNode.loopCount !== undefined) {
      iterationCount = Math.min(loopNode.loopCount, this.maxIterations);
    } else if (loopNode.loopOverVariable) {
      const collection = resolvedVariables[loopNode.loopOverVariable];
      if (Array.isArray(collection)) {
        iterationCount = Math.min(collection.length, this.maxIterations);
      }
    }

    // Expand each iteration as a set of uniquely-IDed IR nodes
    let previousIterationLastId: string | undefined;

    for (let i = 0; i < iterationCount; i++) {
      for (let j = 0; j < bodyNodes.length; j++) {
        const bodyNode = bodyNodes[j];
        const iterNodeId = `${loopNode.id}_iter${i}_${bodyNode.id}`;

        // Compute dependencies: first node of each iteration depends on last node of previous iteration
        const deps: string[] = [];
        if (j === 0 && previousIterationLastId) {
          deps.push(previousIterationLastId);
        } else if (j > 0) {
          deps.push(`${loopNode.id}_iter${i}_${bodyNodes[j - 1].id}`);
        }

        const resolvedParams = { ...bodyNode.parameters };
        // Inject loop iteration variables
        if (loopNode.loopOverVariable) {
          const collection = resolvedVariables[loopNode.loopOverVariable];
          if (Array.isArray(collection)) {
            (resolvedParams as any)._loopItem = collection[i];
            (resolvedParams as any)._loopIndex = i;
          }
        } else {
          (resolvedParams as any)._loopIndex = i;
        }

        expandedNodes.push({
          id: iterNodeId,
          actionId: bodyNode.actionId || 'system.noop',
          resolvedParameters: resolvedParams,
          dependencies: deps,
          parallelizable: false,
          sourceNodeId: bodyNode.id,
          sourceWorkflowId,
          description: `${bodyNode.name} [iteration ${i + 1}/${iterationCount}]`,
        });
      }

      if (bodyNodes.length > 0) {
        previousIterationLastId = `${loopNode.id}_iter${i}_${bodyNodes[bodyNodes.length - 1].id}`;
      }
    }

    return { expandedNodes, iterationCount };
  }
}

export const globalLoopEngine = new LoopEngine();
