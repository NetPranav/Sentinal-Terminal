import { invoke } from '@tauri-apps/api/core';

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
  private static instance?: AuditLogger;
  private logs: AuditLogEntry[] = [];

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const fullEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    
    this.logs.push(fullEntry);
    
    console.log('[AuditLogger] Logged execution:', fullEntry);

    // Skip native disk writes during unit tests
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      // Append to immutable JSONL audit log via Tauri backend
      const jsonLine = JSON.stringify(fullEntry).replace(/'/g, "'\\''");
      const cmd = `mkdir -p "$HOME/.sentinel" && echo '${jsonLine}' >> "$HOME/.sentinel/audit.jsonl"`;
      await invoke('execute_command', { command: 'sh', args: ['-c', cmd] });
    } catch (err) {
      // Fallback to localStorage in web preview / browser dev mode
      if (typeof localStorage !== 'undefined') {
        try {
          const existing = localStorage.getItem('sentinel_audit_logs') || '';
          localStorage.setItem('sentinel_audit_logs', existing + JSON.stringify(fullEntry) + '\n');
        } catch { /* ignore */ }
      }
    }
  }

  async exportLogs(): Promise<AuditLogEntry[]> {
    return [...this.logs];
  }
}
