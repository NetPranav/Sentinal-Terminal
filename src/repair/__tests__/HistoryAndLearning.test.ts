import { describe, it, expect, beforeEach } from 'vitest';
import { RepairHistoryStore } from '../history/RepairHistoryStore';
import { AdaptiveLearningTracker } from '../learning/AdaptiveLearningTracker';
import { FailureClassifier } from '../models/FailureClassification';

describe('RepairHistoryStore & AdaptiveLearningTracker — Structured Historical Learning', () => {
  let store: RepairHistoryStore;
  let tracker: AdaptiveLearningTracker;

  beforeEach(() => {
    store = new RepairHistoryStore();
    tracker = new AdaptiveLearningTracker(store);
  });

  it('should preserve every repair attempt as structured historical data containing failures and outcomes', () => {
    const diag1 = FailureClassifier.classify('wifi.connect', 'ENOTFOUND: offline');
    const diag2 = FailureClassifier.classify('process.bind', 'ETIMEDOUT: timeout reached');

    store.recordAttempt(diag1, 'StateRefreshStrategy', 'success', 14.5);
    store.recordAttempt(diag2, 'RetryStrategy', 'failed', 20.0);

    const history = store.getHistory(10);
    expect(history.length).toBe(2);
    
    const stats = store.getStats();
    expect(stats.totalAttempts).toBe(2);
    expect(stats.successes).toBe(1);
    expect(stats.failures).toBe(1);
    expect(stats.successRate).toBe(50);
  });

  it('should rank recovery strategy efficacy for specific failure categories via structured pattern telemetry', () => {
    const diag = FailureClassifier.classify('network.wifi', 'ENOTFOUND: offline');

    // Simulate several historical repair outcomes
    store.recordAttempt(diag, 'StateRefreshStrategy', 'success', 12.0);
    store.recordAttempt(diag, 'StateRefreshStrategy', 'success', 10.0);
    store.recordAttempt(diag, 'RetryStrategy', 'failed', 45.0);
    store.recordAttempt(diag, 'RetryStrategy', 'success', 25.0);

    const rankings = tracker.rankStrategiesForCategory('Network');
    expect(rankings.length).toBe(2);
    
    expect(rankings[0].strategyName).toBe('StateRefreshStrategy');
    expect(rankings[0].successRate).toBe(100);
    expect(rankings[0].avgLatencyMs).toBe(11);

    const recommended = tracker.getRecommendedStrategy('Network', 'RetryStrategy');
    expect(recommended).toBe('StateRefreshStrategy');
  });

  it('should isolate high-frequency operational failure patterns across recent execution sessions without model training', () => {
    const dPerm = FailureClassifier.classify('fs.delete', 'EACCES: permission denied');
    const dTimeout = FailureClassifier.classify('docker.start', 'ETIMEDOUT: start timed out');

    store.recordAttempt(dPerm, 'PermissionRecoveryStrategy', 'success', 150);
    store.recordAttempt(dPerm, 'PermissionRecoveryStrategy', 'success', 140);
    store.recordAttempt(dPerm, 'PermissionRecoveryStrategy', 'success', 160);
    store.recordAttempt(dTimeout, 'RetryStrategy', 'success', 40);

    const patterns = tracker.getCommonFailurePatterns(3);
    expect(patterns[0].category).toBe('Permission');
    expect(patterns[0].count).toBe(3);
    expect(patterns[1].category).toBe('Timeout');
    expect(patterns[1].count).toBe(1);
  });
});
