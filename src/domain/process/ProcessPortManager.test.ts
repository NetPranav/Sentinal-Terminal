import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessPortManager } from './ProcessPortManager';

describe('ProcessPortManager (Pillar 2.3)', () => {
  let manager: ProcessPortManager;

  beforeEach(() => {
    manager = new ProcessPortManager();
  });

  it('parses standard lsof output accurately', () => {
    const rawLsof = `
COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      14210 pranav   23u  IPv6 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
vite      14582 pranav   19u  IPv4 0xabcdef1234567890      0t0  TCP 127.0.0.1:5173 (LISTEN)
Python    18931 pranav    4u  IPv4 0x9876543210fedcba      0t0  TCP *:8080 (LISTEN)
`;
    const parsed = manager.parseLsofOutput(rawLsof);
    expect(parsed.length).toBe(3);
    expect(parsed[0].port).toBe(3000);
    expect(parsed[0].pid).toBe(14210);
    expect(parsed[0].processName).toBe('node');

    expect(parsed[1].port).toBe(5173);
    expect(parsed[1].processName).toBe('vite');

    expect(parsed[2].port).toBe(8080);
    expect(parsed[2].processName).toBe('Python');
  });

  it('returns mock listening ports in test environment', async () => {
    const ports = await manager.getListeningPorts();
    expect(ports.length).toBe(3);
    expect(ports.some(p => p.port === 3000)).toBe(true);
  });

  it('frees port successfully in mock environment', async () => {
    const success = await manager.freePort(3000);
    expect(success).toBe(true);
  });
});
