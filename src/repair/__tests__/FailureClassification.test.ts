import { describe, it, expect } from 'vitest';
import { FailureClassifier, FailureCategory } from '../models/FailureClassification';

describe('FailureClassifier — Structured Taxonomy & Diagnosis Validation', () => {
  it('should deterministically classify system error strings across all 9 formal failure categories', () => {
    const testCases: Array<{ msg: string; expected: FailureCategory; recoverable: boolean }> = [
      { msg: 'EACCES: permission denied when accessing Full Disk Access volume', expected: 'Permission', recoverable: true },
      { msg: 'ETIMEDOUT: Action execution timed out after 30000ms', expected: 'Timeout', recoverable: true },
      { msg: 'ENOTFOUND: WiFi SSID offline or connection refused', expected: 'Network', recoverable: true },
      { msg: 'Error: missing dependency binary which: no docker in PATH', expected: 'Dependency', recoverable: true },
      { msg: 'ENOENT: target folder does not exist in filesystem storage', expected: 'MissingResource', recoverable: true },
      { msg: 'Application deadlock: target bundle id com.apple.Safari is not running', expected: 'ApplicationState', recoverable: true },
      { msg: 'Resource lock collision: database socket is temporarily busy or race detected', expected: 'RaceCondition', recoverable: true },
      { msg: 'Execution aborted via CancellationToken by user request', expected: 'UserCancellation', recoverable: false },
      { msg: 'Unexpected Segmentation fault during background calculation', expected: 'Unknown', recoverable: true },
    ];

    for (const tc of testCases) {
      const diag = FailureClassifier.classify('test.action', tc.msg);
      expect(diag.category).toBe(tc.expected);
      expect(diag.recoverable).toBe(tc.recoverable);
      expect(diag.remedyHint).toBeDefined();
      expect(diag.timestamp).toBeLessThanOrEqual(Date.now());
    }
  });

  it('should generate uniquely stamped diagnostic reports containing action identifiers and error strings', () => {
    const diag = FailureClassifier.classify('wifi.connect', new Error('WiFi connection failed on en0'));
    expect(diag.id).toContain('fail-');
    expect(diag.actionId).toBe('wifi.connect');
    expect(diag.errorMessage).toContain('WiFi connection failed');
  });
});
