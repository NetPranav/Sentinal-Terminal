import { describe, it, expect } from 'vitest';
import { BackupManager } from '../backup/BackupManager';

describe('Production Platform — Resilience & Backups', () => {
  it('BackupManager should generate and store timestamped archive manifests', async () => {
    const backupMgr = new BackupManager();
    const manifest = await backupMgr.createBackup(['settings.json', 'plugins/']);
    
    expect(manifest.components.length).toBe(2);
    expect(backupMgr.getAvailableBackups().length).toBe(1);
    
    const success = await backupMgr.restoreBackup(manifest.timestamp);
    expect(success).toBe(true);
    
    const fail = await backupMgr.restoreBackup(12345);
    expect(fail).toBe(false);
  });
});
