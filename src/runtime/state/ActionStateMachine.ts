/**
 * ActionStateMachine.ts — Strict deterministic lifecycle for each ActionNode
 *
 * Created → Queued → Waiting → Running → Completed | Failed | Cancelled | TimedOut
 */

import { NodeState } from '../models/RuntimeTypes';

const VALID_TRANSITIONS: Record<NodeState, NodeState[]> = {
  created:   ['queued', 'cancelled'],
  queued:    ['waiting', 'running', 'cancelled'],
  waiting:   ['running', 'cancelled'],
  running:   ['completed', 'failed', 'cancelled', 'timed_out'],
  completed: [],
  failed:    ['queued'], // Retry → re-queue
  cancelled: [],
  timed_out: ['queued'], // Retry → re-queue
};

export class ActionStateMachine {
  private states: Map<string, NodeState> = new Map();

  /**
   * Initializes a node in the 'created' state.
   */
  public initialize(nodeId: string): void {
    this.states.set(nodeId, 'created');
  }

  /**
   * Gets the current state of a node.
   */
  public getState(nodeId: string): NodeState {
    const state = this.states.get(nodeId);
    if (!state) throw new Error(`Node '${nodeId}' is not tracked by the state machine.`);
    return state;
  }

  /**
   * Transitions a node to a new state. Throws if the transition is invalid.
   */
  public transition(nodeId: string, to: NodeState): void {
    const from = this.getState(nodeId);
    const allowed = VALID_TRANSITIONS[from];

    if (!allowed.includes(to)) {
      throw new Error(`Invalid state transition for node '${nodeId}': '${from}' → '${to}'`);
    }

    this.states.set(nodeId, to);
  }

  /**
   * Checks if a transition is valid without performing it.
   */
  public canTransition(nodeId: string, to: NodeState): boolean {
    const from = this.states.get(nodeId);
    if (!from) return false;
    return VALID_TRANSITIONS[from].includes(to);
  }

  /**
   * Returns true if the node is in a terminal state.
   */
  public isTerminal(nodeId: string): boolean {
    const state = this.getState(nodeId);
    return state === 'completed' || state === 'cancelled';
  }

  /**
   * Returns true if the node can be retried.
   */
  public isRetryable(nodeId: string): boolean {
    const state = this.getState(nodeId);
    return state === 'failed' || state === 'timed_out';
  }

  /**
   * Returns all node states as a plain object for serialization.
   */
  public exportStates(): Record<string, NodeState> {
    const result: Record<string, NodeState> = {};
    for (const [k, v] of this.states) result[k] = v;
    return result;
  }

  /**
   * Restores node states from a serialized object.
   */
  public restoreStates(states: Record<string, NodeState>): void {
    this.states.clear();
    for (const [k, v] of Object.entries(states)) {
      this.states.set(k, v);
    }
  }
}
