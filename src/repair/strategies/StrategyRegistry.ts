/**
 * StrategyRegistry.ts — Automated Strategy Matching & Discovery Registry
 *
 * Maintains all registered self-healing strategies and prioritizes candidates based on
 * structured failure classifications and long-term adaptive historical pattern success.
 */

import { IRepairStrategy } from './IRepairStrategy';
import { FailureDiagnosis } from '../models/FailureClassification';

import { defaultRetryStrategy } from './RetryStrategy';
import { defaultAlternativeActionStrategy } from './AlternativeActionStrategy';
import { defaultStateRefreshStrategy } from './StateRefreshStrategy';
import { defaultDependencyRepairStrategy } from './DependencyRepairStrategy';
import { defaultPermissionRecoveryStrategy } from './PermissionRecoveryStrategy';
import { defaultUserConfirmationStrategy } from './UserConfirmationStrategy';
import { defaultRollbackStrategy } from './RollbackStrategy';
import { defaultEscalationStrategy } from './EscalationStrategy';

export class StrategyRegistry {
  private strategies: Map<string, IRepairStrategy> = new Map();

  constructor(registerDefaults = true) {
    if (registerDefaults) {
      this.register(defaultRetryStrategy);
      this.register(defaultStateRefreshStrategy);
      this.register(defaultDependencyRepairStrategy);
      this.register(defaultPermissionRecoveryStrategy);
      this.register(defaultAlternativeActionStrategy);
      this.register(defaultUserConfirmationStrategy);
      this.register(defaultRollbackStrategy);
      this.register(defaultEscalationStrategy);
    }
  }

  public register(strategy: IRepairStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  public getStrategy(name: string): IRepairStrategy | undefined {
    return this.strategies.get(name);
  }

  public getAllStrategies(): IRepairStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Determine the most effective ordered candidate repair strategies for a specific failure diagnosis.
   */
  public async getCandidates(diagnosis: FailureDiagnosis): Promise<IRepairStrategy[]> {
    const all = Array.from(this.strategies.values());
    const matched: IRepairStrategy[] = [];

    for (const strat of all) {
      if (await strat.canHandle(diagnosis)) {
        matched.push(strat);
      }
    }

    // Sort strategy order: specialized domain recoveries first, generic catch-alls at end
    const orderPriority: Record<string, number> = {
      PermissionRecoveryStrategy: 1,
      DependencyRepairStrategy: 2,
      StateRefreshStrategy: 3,
      RetryStrategy: 4,
      AlternativeActionStrategy: 5,
      UserConfirmationStrategy: 6,
      RollbackStrategy: 7,
      EscalationStrategy: 8,
    };

    return matched.sort((a, b) => (orderPriority[a.name] || 99) - (orderPriority[b.name] || 99));
  }

  public clear(): void {
    this.strategies.clear();
  }
}

export const globalStrategyRegistry = new StrategyRegistry();
