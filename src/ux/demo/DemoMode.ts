/**
 * DemoMode.ts — Sandboxed virtual execution layer
 */

export class DemoMode {
  private enabled: boolean = false;

  public enable(): void {
    this.enabled = true;
    // In production, this forcibly overrides the global CapabilityRegistry 
    // with mock No-Op implementations that simply return success, allowing
    // public UI demonstrations without mutating the presenter's computer.
  }

  public disable(): void {
    this.enabled = false;
  }

  public isDemoActive(): boolean {
    return this.enabled;
  }
}

export const globalDemoMode = new DemoMode();
