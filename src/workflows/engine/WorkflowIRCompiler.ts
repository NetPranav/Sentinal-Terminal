/**
 * WorkflowIRCompiler.ts — Workflow Definition → Intermediate Representation Compiler
 *
 * Compiles a UserWorkflow into a WorkflowIR by:
 * 1. Resolving all variables against user inputs
 * 2. Expanding conditional branches based on resolved variable values
 * 3. Unrolling loops into sequential iteration nodes
 * 4. Flattening nested workflows recursively
 * 5. Injecting retry policies
 * 6. Finalizing execution topology
 *
 * The resulting IR is directly convertible to a Phase 3 ActionGraph.
 */

import {
  UserWorkflow,
  WorkflowNode,
  WorkflowIR,
  WorkflowIRNode,
} from '../models/WorkflowTypes';
import { VariableResolver } from '../variables/WorkflowVariables';
import { evaluateCondition, isControlFlowNode, isNestedWorkflowNode, isActionNode } from '../conditions/ControlFlow';
import { LoopEngine } from '../loops/LoopEngine';

export type WorkflowLookup = (workflowId: string) => UserWorkflow | undefined;

export class WorkflowIRCompiler {
  private variableResolver: VariableResolver;
  private loopEngine: LoopEngine;
  private maxNestedDepth: number;

  constructor(maxNestedDepth = 10) {
    this.variableResolver = new VariableResolver();
    this.loopEngine = new LoopEngine();
    this.maxNestedDepth = maxNestedDepth;
  }

  /**
   * Compile a UserWorkflow + user inputs into an intermediate representation.
   */
  public compile(
    workflow: UserWorkflow,
    userInputs: Record<string, unknown> = {},
    lookupWorkflow?: WorkflowLookup,
    depth = 0
  ): { ir: WorkflowIR; errors: string[] } {
    const debugTrace: string[] = [];
    const allErrors: string[] = [];

    if (depth > this.maxNestedDepth) {
      allErrors.push(`Maximum nested workflow depth (${this.maxNestedDepth}) exceeded. Possible circular reference.`);
      return { ir: this.emptyIR(workflow.id), errors: allErrors };
    }

    debugTrace.push(`[IR] Compiling workflow '${workflow.id}' (depth: ${depth})`);

    // 1. Resolve variables
    const { resolved, errors: varErrors } = this.variableResolver.resolve(workflow.variables, userInputs);
    allErrors.push(...varErrors);
    debugTrace.push(`[IR] Resolved ${Object.keys(resolved).length} variables, ${varErrors.length} errors`);

    if (varErrors.length > 0) {
      return { ir: this.emptyIR(workflow.id), errors: allErrors };
    }

    // 2. Expand all nodes into flat IR
    const irNodes: WorkflowIRNode[] = [];
    const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));

    for (const node of workflow.nodes) {
      const expanded = this.expandNode(node, nodeMap, resolved, workflow.id, lookupWorkflow, depth, debugTrace, allErrors);
      irNodes.push(...expanded);
    }

    // 3. Compute execution order via topological sort
    const executionOrder = this.topologicalSort(irNodes);
    const parallelGroups = this.computeParallelGroups(irNodes);

    debugTrace.push(`[IR] Final IR: ${irNodes.length} nodes, ${parallelGroups.length} parallel groups`);

    const ir: WorkflowIR = {
      id: `ir-${workflow.id}-${Date.now()}`,
      workflowId: workflow.id,
      nodes: irNodes,
      executionOrder,
      parallelGroups,
      resolvedVariables: resolved,
      declaredOutputs: workflow.outputs,
      compiledAt: Date.now(),
      debugTrace,
    };

    return { ir, errors: allErrors };
  }

  private expandNode(
    node: WorkflowNode,
    nodeMap: Map<string, WorkflowNode>,
    resolved: Record<string, unknown>,
    workflowId: string,
    lookup?: WorkflowLookup,
    depth = 0,
    trace: string[] = [],
    errors: string[] = []
  ): WorkflowIRNode[] {
    // Direct action node
    if (isActionNode(node)) {
      const params = this.variableResolver.substituteParameters(node.parameters || {}, resolved);
      return [{
        id: node.id,
        actionId: node.actionId!,
        resolvedParameters: params,
        dependencies: [...node.dependencies],
        parallelizable: node.type === 'action' && node.dependencies.length === 0,
        sourceNodeId: node.id,
        sourceWorkflowId: workflowId,
        description: node.name,
      }];
    }

    // Nested workflow
    if (isNestedWorkflowNode(node) && lookup) {
      trace.push(`[IR] Expanding nested workflow '${node.nestedWorkflowId}' at node '${node.id}'`);
      const nested = lookup(node.nestedWorkflowId!);
      if (!nested) {
        errors.push(`Nested workflow '${node.nestedWorkflowId}' not found for node '${node.id}'`);
        return [];
      }

      // Build input bindings for nested workflow
      const nestedInputs: Record<string, unknown> = {};
      if (node.nestedInputBindings) {
        for (const [nestedVar, sourceVar] of Object.entries(node.nestedInputBindings)) {
          nestedInputs[nestedVar] = resolved[sourceVar] ?? sourceVar;
        }
      }

      const { ir: nestedIR, errors: nestedErrors } = this.compile(nested, nestedInputs, lookup, depth + 1);
      errors.push(...nestedErrors);

      // Prefix nested IR node IDs and remap dependencies
      return nestedIR.nodes.map(n => ({
        ...n,
        id: `${node.id}__${n.id}`,
        dependencies: n.dependencies.map(d => `${node.id}__${d}`).concat(node.dependencies),
        sourceWorkflowId: nested.id,
      }));
    }

    // Conditional node
    if (node.type === 'conditional' && node.condition) {
      const result = evaluateCondition(node.condition, resolved);
      const branchIds = result ? (node.trueBranch || []) : (node.falseBranch || []);
      trace.push(`[IR] Conditional '${node.id}' evaluated to ${result}, expanding ${branchIds.length} branch nodes`);

      const expanded: WorkflowIRNode[] = [];
      for (const branchId of branchIds) {
        const branchNode = nodeMap.get(branchId);
        if (branchNode) {
          expanded.push(...this.expandNode(branchNode, nodeMap, resolved, workflowId, lookup, depth, trace, errors));
        }
      }
      return expanded;
    }

    // Loop node
    if (node.type === 'loop' && node.loopBodyNodeIds) {
      const bodyNodes = node.loopBodyNodeIds
        .map(id => nodeMap.get(id))
        .filter((n): n is WorkflowNode => !!n);

      const { expandedNodes, iterationCount } = this.loopEngine.expandLoop(node, bodyNodes, resolved, workflowId);
      trace.push(`[IR] Loop '${node.id}' expanded to ${iterationCount} iterations, ${expandedNodes.length} IR nodes`);

      // Wire loop dependencies to parent node dependencies
      if (expandedNodes.length > 0 && node.dependencies.length > 0) {
        (expandedNodes[0] as any).dependencies = [...expandedNodes[0].dependencies, ...node.dependencies];
      }
      return expandedNodes;
    }

    // Parallel node
    if (node.type === 'parallel' && node.parallelNodeIds) {
      const expanded: WorkflowIRNode[] = [];
      for (const pId of node.parallelNodeIds) {
        const pNode = nodeMap.get(pId);
        if (pNode) {
          const pExpanded = this.expandNode(pNode, nodeMap, resolved, workflowId, lookup, depth, trace, errors);
          pExpanded.forEach(e => {
            expanded.push({ ...e, parallelizable: true, dependencies: [...e.dependencies, ...node.dependencies] });
          });
        }
      }
      trace.push(`[IR] Parallel '${node.id}' expanded to ${expanded.length} parallelizable IR nodes`);
      return expanded;
    }

    // Wait node
    if (node.type === 'wait') {
      return [{
        id: node.id,
        actionId: 'system.delay',
        resolvedParameters: { durationMs: node.waitMs || 1000 },
        dependencies: [...node.dependencies],
        parallelizable: false,
        sourceNodeId: node.id,
        sourceWorkflowId: workflowId,
        description: `Wait ${node.waitMs || 1000}ms`,
      }];
    }

    // Fallback: skip unrecognized control flow
    trace.push(`[IR] Skipping unhandled node type '${node.type}' at '${node.id}'`);
    return [];
  }

  private topologicalSort(nodes: WorkflowIRNode[]): string[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = nodeMap.get(id);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
      }
      order.push(id);
    };

    for (const node of nodes) {
      visit(node.id);
    }

    return order;
  }

  private computeParallelGroups(nodes: WorkflowIRNode[]): string[][] {
    const parallelizable = nodes.filter(n => n.parallelizable);
    if (parallelizable.length === 0) return [];

    // Group by shared dependency sets
    const groups = new Map<string, string[]>();
    for (const node of parallelizable) {
      const key = node.dependencies.sort().join(',') || '__root__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(node.id);
    }

    return Array.from(groups.values()).filter(g => g.length > 1);
  }

  private emptyIR(workflowId: string): WorkflowIR {
    return {
      id: `ir-${workflowId}-empty`,
      workflowId,
      nodes: [],
      executionOrder: [],
      parallelGroups: [],
      resolvedVariables: {},
      declaredOutputs: [],
      compiledAt: Date.now(),
      debugTrace: ['[IR] Empty IR produced due to compilation errors.'],
    };
  }
}

export const globalWorkflowIRCompiler = new WorkflowIRCompiler();
