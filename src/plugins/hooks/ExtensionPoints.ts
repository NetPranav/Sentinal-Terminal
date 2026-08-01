/**
 * ExtensionPoints.ts — Event-Driven Core Hooks
 *
 * Allows plugins to subscribe to Core lifecycle events without modifying Core.
 */

export type HookEventName = 
  | 'BeforePlanning' 
  | 'AfterPlanning' 
  | 'BeforeExecution' 
  | 'AfterExecution' 
  | 'BeforeVerification' 
  | 'AfterVerification' 
  | 'MemoryUpdated' 
  | 'WorkflowSaved' 
  | 'SessionStarted' 
  | 'SessionCompleted';

export type HookCallback = (context: any) => Promise<void> | void;

export class ExtensionPoints {
  private hooks: Map<HookEventName, Set<HookCallback>> = new Map();

  public subscribe(event: HookEventName, callback: HookCallback): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, new Set());
    }
    this.hooks.get(event)!.add(callback);
  }

  public unsubscribe(event: HookEventName, callback: HookCallback): void {
    const set = this.hooks.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  public async emit(event: HookEventName, context: any): Promise<void> {
    const set = this.hooks.get(event);
    if (set) {
      const promises = Array.from(set).map(cb => {
        try {
          return Promise.resolve(cb(context));
        } catch (e) {
          console.error(`Hook Error [${event}]:`, e);
          return Promise.resolve(); // Do not crash core on hook failure
        }
      });
      await Promise.allSettled(promises);
    }
  }
}

export const globalExtensionPoints = new ExtensionPoints();
