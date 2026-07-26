export interface AuditLogEntry {
  id: string;
  timestamp: string;
  capabilityId: string;
  parameters: any;
  riskScore: number;
  permissionResult: 'Granted' | 'Denied' | 'Bypassed';
  executionTimeMs: number;
  verificationResult?: 'Success' | 'Failure' | 'NotApplicable';
  rollbackAvailable: boolean;
  userConfirmation: boolean;
}

export interface IAuditLogger {
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void>;
  exportLogs(): Promise<AuditLogEntry[]>;
}

export class AuditLogger implements IAuditLogger {
  private logs: AuditLogEntry[] = [];

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const fullEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    
    this.logs.push(fullEntry);
    
    // In a real implementation, this would persist to disk via Tauri FS.
    // For now, we store in memory and can simulate persistence.
    console.log('[AuditLogger] Logged execution:', fullEntry);
  }

  async exportLogs(): Promise<AuditLogEntry[]> {
    return [...this.logs];
  }
}
