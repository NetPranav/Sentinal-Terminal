import { describe, it, expect, beforeEach } from 'vitest';
import { HealthMonitor } from '../diagnostics/HealthMonitor';
import { SelfDiagnostics } from '../diagnostics/SelfDiagnostics';
import { CrashManager } from '../crash/CrashManager';
import { Logger } from '../logging/Logger';

describe('Production Platform — Diagnostics & Crash Recovery', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = new HealthMonitor();
  });

  it('SelfDiagnostics should accurately roll up isolated subsystem health bounds', () => {
    monitor.reportHealth('Runtime', 'Healthy');
    monitor.reportHealth('Plugin.com.test', 'Degraded');

    const diag = new SelfDiagnostics(monitor);
    const report = diag.generateReport();
    
    expect(report.overallStatus).toBe('Warning');
    expect(report.subsystems['Runtime'].status).toBe('Healthy');
  });

  it('CrashManager should intercept panics and log fatal telemetry', () => {
    const logger = new Logger();
    const crashMgr = new CrashManager(logger);
    
    crashMgr.intercept(new Error('Fatal UI Freeze'));
    
    const reports = crashMgr.getCrashReports();
    expect(reports.length).toBe(1);
    expect(reports[0].errorMsg).toBe('Fatal UI Freeze');
    expect(logger.getHistory()[0].level).toBe(4); // Fatal
  });
});
