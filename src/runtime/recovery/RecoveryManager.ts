/**
 * RecoveryManager.ts — Basic error containment and failure propagation
 *
 * Ensures the runtime never crashes from uncaught exceptions.
 * Captures failures as events and prevents cascade crashes.
 * (Intelligent automated repair is deferred to later phases).
 */

import { ActionGraph, ActionNode } from '../../actions/models/ActionTypes';
import { NodeState } from '../models/RuntimeTypes';
import { ActionStateMachine } from '../state/ActionStateMachine';
import { RuntimeEventBus } from '../events/RuntimeEventBus';
import { RuntimeHooks } from '../lifecycle/RuntimeHooks';

export class RecoveryManager {
  constructor(
    private stateMachine: ActionStateMachine,
    private eventBus: RuntimeEventBus,
    private hooks?: RuntimeHooks
  ) {}

  /**
   * Handle a failure in an action node. Determines whether dependent nodes must be cancelled
   * or if execution can continue safely.
   */
  public async handleNodeFailure(
    failedNodeId: string,
    graph: ActionGraph,
    sessionId: string,
    errorMsg: string
  ): Promise<{ shouldHaltGraph: boolean; cancelledNodeIds: string[] }> {
    const cancelledNodeIds: string[] = [];
    
    // Check all downstream nodes that depend on this failed node
    const downstream = this.findDependentNodes(failedNodeId, graph);
    
    for (const depNode of downstream) {
      const currentState = this.stateMachine.getState(depNode.id);
      if (!this.stateMachine.isTerminal(depNode.id)) {
        this.stateMachine.transition(depNode.id, 'cancelled');
        cancelledNodeIds.push(depNode.id);
        const cancelEvent = this.eventBus.emit(
          'action_cancelled',
          sessionId,
          { reason: `Upstream dependency '${failedNodeId}' failed: ${errorMsg}` },
          depNode.id
        );
        await this.hooks?.invoke('on_cancellation', cancelEvent);
      }
    }

    // Check if there are any remaining runnable or running nodes in the graph
    const allStates = this.stateMachine.exportStates();
    const hasRemainingWork = Object.values(allStates).some(
      s => s === 'queued' || s === 'waiting' || s === 'running' || s === 'created'
    );

    return {
      shouldHaltGraph: !hasRemainingWork,
      cancelledNodeIds,
    };
  }

  /**
   * Recursively finds all nodes in the graph that depend on the given node ID.
   */
  private findDependentNodes(targetId: string, graph: ActionGraph): ActionNode[] {
    const dependents: ActionNode[] = [];
    const visited = new Set<string>();

    const search = (currentId: string) => {
      for (const node of graph.nodes) {
        if (!visited.has(node.id) && node.dependencies.includes(currentId)) {
          visited.add(node.id);
          dependents.push(node);
          search(node.id); // Check transitive dependencies
        }
      }
    };

    search(targetId);
    return dependents;
  }
}
