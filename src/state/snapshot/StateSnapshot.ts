/**
 * StateSnapshot.ts — Immutable World Model Snapshot Generator & History Log
 *
 * Every state update generates an immutable snapshot (Object.freeze).
 * Maintains a chronological history buffer for debugging, verification, and learning pipelines.
 */

import { WorldModel, deepFreeze } from '../models/WorldModel';

export class StateSnapshotManager {
  private history: WorldModel[] = [];
  private readonly maxHistorySize = 100;
  private currentSnapshot?: WorldModel;

  constructor(initialSnapshot?: WorldModel) {
    if (initialSnapshot) {
      this.recordSnapshot(initialSnapshot);
    }
  }

  /**
   * Records a World Model snapshot in immutable history buffer and sets as current source of truth.
   */
  public recordSnapshot(model: WorldModel): WorldModel {
    const frozen = deepFreeze(model);
    this.currentSnapshot = frozen;
    
    this.history.unshift(frozen);
    if (this.history.length > this.maxHistorySize) {
      this.history.pop();
    }
    return frozen;
  }

  /**
   * Retrieve the current authoritative immutable World Model snapshot.
   */
  public getCurrentSnapshot(): WorldModel | undefined {
    return this.currentSnapshot;
  }

  /**
   * Retrieve a specific historical snapshot by its unique ID.
   */
  public getSnapshotById(snapshotId: string): WorldModel | undefined {
    return this.history.find(s => s.snapshotId === snapshotId);
  }

  /**
   * Return the latest N chronological snapshots for learning pipelines or replay analysis.
   */
  public getRecentSnapshots(count = 10): WorldModel[] {
    return this.history.slice(0, count);
  }

  /**
   * Return the previous snapshot immediately prior to the current snapshot.
   */
  public getPreviousSnapshot(): WorldModel | undefined {
    return this.history[1];
  }

  public getHistorySize(): number {
    return this.history.length;
  }

  public clearHistory(): void {
    const current = this.currentSnapshot;
    this.history = current ? [current] : [];
  }
}

export const globalStateSnapshotManager = new StateSnapshotManager();
