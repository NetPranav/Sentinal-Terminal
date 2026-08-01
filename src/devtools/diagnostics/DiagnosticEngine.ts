/**
 * DiagnosticEngine.ts — Error and warning consolidation
 */

import { TraceEngine } from '../tracing/TraceEngine';
import { DiagnosticIssue } from '../models/DevToolsTypes';

export class DiagnosticEngine {
  constructor(private traceEngine: TraceEngine) {}

  public generateReport(): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];
    const history = this.traceEngine.getHistory();

    for (const event of history) {
      if (event.eventName.toLowerCase().includes('failed') || 
          event.eventName.toLowerCase().includes('error')) {
        
        issues.push({
          id: `diag_${event.id}`,
          subsystem: event.subsystem,
          severity: 'error',
          message: `Detected failure in ${event.eventName}`,
          timestamp: event.timestamp
        });
      }
    }

    return issues.sort((a, b) => b.timestamp - a.timestamp);
  }
}
