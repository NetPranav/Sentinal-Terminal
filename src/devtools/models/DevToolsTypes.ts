/**
 * DevToolsTypes.ts — Core Data Models for Observability
 */

export type SubsystemType = 
  | 'Conversation' 
  | 'Planner' 
  | 'Runtime' 
  | 'State' 
  | 'Verification' 
  | 'Workflow' 
  | 'Memory' 
  | 'Learning' 
  | 'Plugin';

export interface TraceEvent {
  readonly id: string;
  readonly timestamp: number;
  readonly subsystem: SubsystemType;
  readonly eventName: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface Metric {
  readonly name: string;
  readonly value: number;
  readonly unit: 'ms' | 'count' | 'bytes' | 'percent';
}

export interface DiagnosticIssue {
  readonly id: string;
  readonly subsystem: SubsystemType;
  readonly severity: 'info' | 'warning' | 'error' | 'critical';
  readonly message: string;
  readonly timestamp: number;
}
