/**
 * SelfDiagnostics.ts — Generates human readable reports
 */

import { HealthMonitor } from './HealthMonitor';

export interface DiagnosticReport {
  readonly timestamp: number;
  readonly overallStatus: 'Pass' | 'Warning' | 'Fail';
  readonly subsystems: Record<string, any>;
}

export class SelfDiagnostics {
  constructor(private monitor: HealthMonitor) {}

  public generateReport(): DiagnosticReport {
    const health = this.monitor.getAllHealth();
    let fails = 0;
    let warns = 0;

    for (const sys of Object.values(health)) {
      if (sys.status === 'Offline') fails++;
      if (sys.status === 'Degraded') warns++;
    }

    let overallStatus: 'Pass' | 'Warning' | 'Fail' = 'Pass';
    if (warns > 0) overallStatus = 'Warning';
    if (fails > 0) overallStatus = 'Fail';

    return {
      timestamp: Date.now(),
      overallStatus,
      subsystems: health
    };
  }
}
