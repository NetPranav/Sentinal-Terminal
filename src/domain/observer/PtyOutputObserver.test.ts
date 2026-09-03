import { describe, it, expect, beforeEach } from 'vitest';
import { PtyOutputObserver } from './PtyOutputObserver';

describe('PtyOutputObserver — Passive Output Stream Error Detection', () => {
  let observer: PtyOutputObserver;

  beforeEach(() => {
    observer = new PtyOutputObserver();
    observer.clearRemediation();
  });

  it('detects EADDRINUSE port collision from raw shell output and generates remediation', () => {
    const chunk = `
> dev-server@1.0.0 start
> node server.js

Error: listen EADDRINUSE: address already in use :::3000
    at Server.setupListenHandle [as _listen2] (net.js:1318:16)
`;
    const rem = observer.ingest(chunk, '/test/repo');
    expect(rem).not.toBeNull();
    expect(rem?.cause).toContain('3000');
    expect(rem?.actionTitle).toContain('3000');
    expect(rem?.tool).toBe('system.kill_process');
    expect(rem?.params.port).toBe(3000);
  });

  it('notifies registered listeners when a recoverable error stream is observed', () => {
    let notifiedRem: any = null;
    const unsub = observer.onRemediation((rem) => {
      notifiedRem = rem;
    });

    observer.ingest('fatal: Unable to create \'.git/index.lock\': File exists.', '/test/repo');
    expect(notifiedRem).not.toBeNull();
    expect(notifiedRem.actionTitle).toContain('.git/index.lock');
    expect(notifiedRem.tool).toBe('filesystem.delete');

    unsub();
  });

  it('returns null and does not false-positive on standard successful output', () => {
    const chunk = `
vite v5.0.0 ready in 150 ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
`;
    const rem = observer.ingest(chunk, '/test/repo');
    expect(rem).toBeNull();
    expect(observer.getActiveRemediation()).toBeNull();
  });
});
