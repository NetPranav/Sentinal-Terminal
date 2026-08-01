import { describe, it, expect } from 'vitest';
import { StrategyRegistry } from '../strategies/StrategyRegistry';
import { RetryStrategy } from '../strategies/RetryStrategy';
import { FailureClassifier } from '../models/FailureClassification';

describe('StrategyRegistry & 8 Modular Self-Healing Strategies', () => {
  const registry = new StrategyRegistry(true);

  it('should maintain all 8 specialized self-healing strategy evaluators in active registry', () => {
    const all = registry.getAllStrategies();
    expect(all.length).toBe(8);

    const expectedNames = [
      'RetryStrategy',
      'StateRefreshStrategy',
      'DependencyRepairStrategy',
      'PermissionRecoveryStrategy',
      'AlternativeActionStrategy',
      'UserConfirmationStrategy',
      'RollbackStrategy',
      'EscalationStrategy',
    ];

    for (const n of expectedNames) {
      expect(registry.getStrategy(n)).toBeDefined();
    }
  });

  it('should support multi-mode retry policies: immediate, delayed, exponential backoff, dependency, and interactive', async () => {
    const policies: Array<any> = [
      { mode: 'immediate', maxAttempts: 2, baseDelayMs: 0 },
      { mode: 'delayed', maxAttempts: 3, baseDelayMs: 200 },
      { mode: 'exponential-backoff', maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 1000 },
      { mode: 'dependency-triggered', maxAttempts: 1, baseDelayMs: 50 },
      { mode: 'user-approval', maxAttempts: 1, baseDelayMs: 0, requireUserConfirmation: true },
    ];

    const diag = FailureClassifier.classify('action.test', 'ETIMEDOUT: timeout reached');

    for (const pol of policies) {
      const strat = new RetryStrategy(pol);
      expect(strat.canHandle(diag)).toBe(true);
      expect(strat.requiresUserConfirmation).toBe(pol.mode === 'user-approval' || !!pol.requireUserConfirmation);

      const plan = await strat.generatePlan(diag, 'action.test');
      expect(plan.nodes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should automatically match and prioritize specialized domain strategies over general terminal escalation', async () => {
    const diagPerm = FailureClassifier.classify('filesystem.delete', 'EACCES: permission denied');
    const permCandidates = await registry.getCandidates(diagPerm);
    expect(permCandidates[0].name).toBe('PermissionRecoveryStrategy');

    const diagDep = FailureClassifier.classify('docker.run', 'missing dependency binary docker');
    const depCandidates = await registry.getCandidates(diagDep);
    expect(depCandidates[0].name).toBe('DependencyRepairStrategy');

    const diagUnk = FailureClassifier.classify('app.unknown', 'Segmentation fault encountered');
    const unkCandidates = await registry.getCandidates(diagUnk);
    expect(unkCandidates.some(c => c.name === 'AlternativeActionStrategy' || c.name === 'RollbackStrategy')).toBe(true);
    expect(unkCandidates[unkCandidates.length - 1].name).toBe('EscalationStrategy');
  });

  it('should enforce user confirmation checkpoints on PermissionRecovery and UserConfirmation strategies', () => {
    const perm = registry.getStrategy('PermissionRecoveryStrategy')!;
    const confirm = registry.getStrategy('UserConfirmationStrategy')!;
    expect(perm.requiresUserConfirmation).toBe(true);
    expect(confirm.requiresUserConfirmation).toBe(true);
  });
});
