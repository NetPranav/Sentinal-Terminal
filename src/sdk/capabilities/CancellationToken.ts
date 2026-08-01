/**
 * CancellationToken.ts — Lightweight token for propagating cooperative cancellation to executing capabilities
 */

export class CancellationToken {
  private _isCancelled = false;
  private callbacks: Array<() => void> = [];

  public get isCancelled(): boolean {
    return this._isCancelled;
  }

  public cancel(): void {
    if (this._isCancelled) return;
    this._isCancelled = true;
    for (const cb of this.callbacks) {
      try { cb(); } catch (_) { /* ignore callback errors */ }
    }
    this.callbacks = [];
  }

  public onCancel(callback: () => void): () => void {
    if (this._isCancelled) {
      callback();
      return () => {};
    }
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  public throwIfCancelled(message = 'Execution cancelled'): void {
    if (this._isCancelled) {
      throw new Error(message);
    }
  }
}
