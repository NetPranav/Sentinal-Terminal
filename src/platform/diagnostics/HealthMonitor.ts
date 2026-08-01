/**
 * HealthMonitor.ts — Continuous subsystem tracking
 */

export type HealthStatus = 'Healthy' | 'Degraded' | 'Offline';

export interface SubsystemHealth {
  readonly status: HealthStatus;
  readonly lastUpdated: number;
  readonly message?: string;
}

export class HealthMonitor {
  private subsystems: Map<string, SubsystemHealth> = new Map();

  public reportHealth(subsystem: string, status: HealthStatus, message?: string): void {
    this.subsystems.set(subsystem, {
      status,
      lastUpdated: Date.now(),
      message
    });
  }

  public getHealth(subsystem: string): SubsystemHealth {
    return this.subsystems.get(subsystem) || { status: 'Offline', lastUpdated: 0 };
  }

  public getAllHealth(): Record<string, SubsystemHealth> {
    const report: Record<string, SubsystemHealth> = {};
    this.subsystems.forEach((val, key) => report[key] = val);
    return report;
  }
}

export const globalHealthMonitor = new HealthMonitor();
