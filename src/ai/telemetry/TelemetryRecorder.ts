/**
 * TelemetryRecorder.ts — Autonomous Self-Improvement Telemetry Engine
 * 
 * Automatically captures runtime signals:
 * - failed intent matches
 * - corrected tool selections
 * - ambiguous requests
 * - execution failures
 * This data builds future training datasets for fine-tuning the intent model.
 */

export type TelemetryEventType = 'FAILED_MATCH' | 'TOOL_CORRECTION' | 'AMBIGUOUS_REQUEST' | 'EXECUTION_FAILURE' | 'SUCCESSFUL_MATCH';

export interface TelemetryRecord {
  id: string;
  timestamp: number;
  type: TelemetryEventType;
  userQuery: string;
  originalTool?: string;
  correctedTool?: string;
  confidence?: number;
  errorReason?: string;
  metadata?: Record<string, any>;
}

export class TelemetryRecorder {
  private records: TelemetryRecord[] = [];

  constructor(private maxMemoryRecords: number = 1000) {}

  public record(type: TelemetryEventType, query: string, details: Partial<TelemetryRecord> = {}): TelemetryRecord {
    const rec: TelemetryRecord = {
      id: `tel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      type,
      userQuery: query,
      ...details
    };

    this.records.push(rec);
    if (this.records.length > this.maxMemoryRecords) {
      this.records.shift();
    }

    // Proactively log to console for diagnostic oversight
    if (type !== 'SUCCESSFUL_MATCH') {
      console.log(`[TelemetryRecorder] Captured ${type}: "${query}"`, details.errorReason || details.correctedTool || '');
    }

    return rec;
  }

  public getRecords(filterType?: TelemetryEventType): TelemetryRecord[] {
    if (!filterType) return [...this.records];
    return this.records.filter(r => r.type === filterType);
  }

  public clear(): void {
    this.records = [];
  }
}
