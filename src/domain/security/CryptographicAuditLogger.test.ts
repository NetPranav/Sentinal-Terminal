import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger, GENESIS_HASH } from './AuditLogger';

describe('Cryptographic Audit Logger (Pillar 3.2)', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  it('constructs a valid cryptographic hash chain across executions', async () => {
    await logger.log({
      capabilityId: 'fs.read',
      parameters: { path: '/tmp/test.txt' },
      riskScore: 10,
      permissionResult: 'Granted',
      executionTimeMs: 1.2,
      rollbackAvailable: false,
      userConfirmation: false
    });

    await logger.log({
      capabilityId: 'shell.execute',
      parameters: { command: 'git status' },
      riskScore: 20,
      permissionResult: 'Granted',
      executionTimeMs: 4.5,
      rollbackAvailable: false,
      userConfirmation: false
    });

    const logs = await logger.exportLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].previousHash).toBe(GENESIS_HASH);
    expect(logs[0].hash).toBeDefined();
    expect(logs[1].previousHash).toBe(logs[0].hash);

    const verification = await logger.verifyChain();
    expect(verification.valid).toBe(true);
    expect(verification.totalEntries).toBe(2);
  });

  it('detects tampering or payload modification in audit log history', async () => {
    await logger.log({
      capabilityId: 'fs.write',
      parameters: { path: '/etc/hosts', content: 'hacked' },
      riskScore: 90,
      permissionResult: 'Denied',
      executionTimeMs: 0.8,
      rollbackAvailable: false,
      userConfirmation: true
    });

    const logs = await logger.exportLogs();
    expect(logs.length).toBe(1);

    // Tamper with log parameters
    logs[0].permissionResult = 'Granted';

    const verification = await logger.verifyChain(logs);
    expect(verification.valid).toBe(false);
    expect(verification.brokenIndex).toBe(0);
    expect(verification.error).toContain('Tampered log payload');
  });

  it('exports signed enterprise audit report', async () => {
    await logger.log({
      capabilityId: 'system.reboot',
      parameters: {},
      riskScore: 95,
      permissionResult: 'Granted',
      executionTimeMs: 2.1,
      rollbackAvailable: false,
      userConfirmation: true
    });

    const reportJson = await logger.exportSignedAuditReport();
    const report = JSON.parse(reportJson);
    expect(report.standard).toBe('SOC2-TypeII-ISO27001');
    expect(report.integrityVerified).toBe(true);
    expect(report.entryCount).toBe(1);
    expect(report.rootHash).toBeDefined();
  });
});
