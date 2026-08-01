import { describe, it, expect } from 'vitest';
import { PerformanceProfiler } from '../profiler/PerformanceProfiler';
import { IDebugProvider } from '../providers/IDebugProvider';
import { Metric } from '../models/DevToolsTypes';

class MockPlannerProvider implements IDebugProvider {
  subsystemName = 'Planner' as const;
  getSnapshot() { return {}; }
  getConfiguration() { return {}; }
  getMetrics(): Metric[] {
    return [
      { name: 'PlanningLatency', value: 120, unit: 'ms' },
      { name: 'GoalsExtracted', value: 3, unit: 'count' }
    ];
  }
}

describe('PerformanceProfiler — Distributed Aggregation', () => {
  it('should aggregate metrics from all registered providers safely', () => {
    const profiler = new PerformanceProfiler();
    profiler.registerProvider(new MockPlannerProvider());

    const report = profiler.aggregateMetrics();
    expect(report['Planner']).toBeDefined();
    expect(report['Planner'].length).toBe(2);
    expect(report['Planner'][0].value).toBe(120);
  });
});
