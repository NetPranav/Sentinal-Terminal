/**
 * PluginTelemetry.ts — Tracks Load Times, Usage, and Crashes
 */

export interface PluginMetrics {
  readonly pluginId: string;
  loadTimeMs: number;
  crashes: number;
  permissionDenials: number;
}

export class PluginTelemetry {
  private metrics: Map<string, PluginMetrics> = new Map();

  private getMetrics(id: string): PluginMetrics {
    if (!this.metrics.has(id)) {
      this.metrics.set(id, { pluginId: id, loadTimeMs: 0, crashes: 0, permissionDenials: 0 });
    }
    return this.metrics.get(id)!;
  }

  public recordLoadTime(id: string, ms: number): void {
    this.getMetrics(id).loadTimeMs = ms;
  }

  public recordCrash(id: string): void {
    this.getMetrics(id).crashes++;
  }

  public recordPermissionDenial(id: string): void {
    this.getMetrics(id).permissionDenials++;
  }

  public getStats(): PluginMetrics[] {
    return Array.from(this.metrics.values());
  }
}

export const globalPluginTelemetry = new PluginTelemetry();
