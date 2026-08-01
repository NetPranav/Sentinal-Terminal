/**
 * CrashManager.ts — Global Exception Interceptor
 */

import { Logger } from '../logging/Logger';

export interface CrashReport {
  readonly id: string;
  readonly errorMsg: string;
  readonly stack?: string;
  readonly timestamp: number;
}

export class CrashManager {
  private crashes: CrashReport[] = [];

  constructor(private logger: Logger) {}

  public intercept(error: Error): void {
    const report: CrashReport = {
      id: `crash_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      errorMsg: error.message,
      stack: error.stack,
      timestamp: Date.now()
    };

    this.crashes.push(report);
    this.logger.fatal(`Unhandled Exception: ${error.message}`, { reportId: report.id });
    
    // In production, this would trigger an IPC call to the main process
    // to show a Recovery Dialog window to the user.
  }

  public getCrashReports(): ReadonlyArray<CrashReport> {
    return this.crashes;
  }
}
