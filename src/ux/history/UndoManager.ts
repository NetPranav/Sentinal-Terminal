/**
 * UndoManager.ts — Reversible action stack management
 */

export interface UndoOperation {
  readonly id: string;
  readonly description: string;
  readonly timestamp: number;
  rollback(): Promise<boolean>;
}

export class UndoManager {
  private stack: UndoOperation[] = [];

  public push(operation: UndoOperation): void {
    this.stack.push(operation);
  }

  public getStack(): ReadonlyArray<UndoOperation> {
    return this.stack;
  }

  public async undo(): Promise<boolean> {
    const op = this.stack.pop();
    if (!op) return false;
    
    try {
      return await op.rollback();
    } catch (e) {
      console.error('Undo failed:', e);
      return false;
    }
  }

  public clear(): void {
    this.stack = [];
  }
}

export const globalUndoManager = new UndoManager();
