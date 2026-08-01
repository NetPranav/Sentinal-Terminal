/**
 * RuntimeHooks.ts — Extensible lifecycle hooks
 *
 * Hooks allow plugins, logging, analytics, debugging, and learning
 * without modifying the Runtime.
 */

import { HookType, HookCallback, ExecutionEvent } from '../models/RuntimeTypes';

export class RuntimeHooks {
  private hooks: Map<HookType, HookCallback[]> = new Map();

  /**
   * Register a hook callback. Returns an unsubscribe function.
   */
  public register(type: HookType, callback: HookCallback): () => void {
    const arr = this.hooks.get(type) || [];
    arr.push(callback);
    this.hooks.set(type, arr);

    return () => {
      const current = this.hooks.get(type) || [];
      this.hooks.set(type, current.filter(h => h !== callback));
    };
  }

  /**
   * Invoke all registered hooks for a given type.
   * Hooks errors are caught and silently ignored to prevent crashing the runtime.
   */
  public async invoke(type: HookType, event: ExecutionEvent): Promise<void> {
    const callbacks = this.hooks.get(type) || [];
    for (const cb of callbacks) {
      try {
        await cb(event);
      } catch (_) {
        // Hooks must never crash the runtime
      }
    }
  }

  /**
   * Clears all hooks.
   */
  public clear(): void {
    this.hooks.clear();
  }
}
