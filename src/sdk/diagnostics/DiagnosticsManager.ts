/**
 * DiagnosticsManager.ts — Decentralized Orchestration Engine for Subsystem Diagnostics
 *
 * Coordinates health checks and diagnostic sweeps across capabilities.
 * Guarantees completely structured diagnostic payloads (never unstructured plain-text logs).
 */

import { ICapability, DiagnosticsReport } from '../capabilities/CapabilityTypes';

export class DiagnosticsManager {
  /**
   * Run structured diagnostic checks on a single capability.
   */
  public async diagnoseCapability(capability: ICapability): Promise<DiagnosticsReport> {
    try {
      const report = await capability.diagnostics();
      capability.metadata.health = report.healthy ? 'healthy' : 'degraded';
      return report;
    } catch (err: any) {
      capability.metadata.health = 'unhealthy';
      return {
        healthy: false,
        warnings: [`Diagnostic check threw exception: ${err?.message || String(err)}`],
        missingDependencies: [],
        permissionIssues: [],
        recommendations: ['Restartcapability runtime or re-initialize driver resources.'],
      };
    }
  }

  /**
   * Run system-wide diagnostic sweep across an array of capabilities, aggregating structured reports.
   */
  public async diagnoseAll(capabilities: ICapability[]): Promise<DiagnosticsReport> {
    const aggregate: DiagnosticsReport = {
      healthy: true,
      warnings: [],
      missingDependencies: [],
      permissionIssues: [],
      recommendations: [],
    };

    for (const cap of capabilities) {
      const rep = await this.diagnoseCapability(cap);
      if (!rep.healthy) aggregate.healthy = false;
      
      rep.warnings.forEach(w => aggregate.warnings.push(`[${cap.metadata.id}] ${w}`));
      rep.missingDependencies.forEach(d => aggregate.missingDependencies.push(`[${cap.metadata.id}] ${d}`));
      rep.permissionIssues.forEach(p => aggregate.permissionIssues.push(`[${cap.metadata.id}] ${p}`));
      rep.recommendations.forEach(r => aggregate.recommendations.push(`[${cap.metadata.id}] ${r}`));
    }

    // Deduplicate lists
    aggregate.warnings = [...new Set(aggregate.warnings)];
    aggregate.missingDependencies = [...new Set(aggregate.missingDependencies)];
    aggregate.permissionIssues = [...new Set(aggregate.permissionIssues)];
    aggregate.recommendations = [...new Set(aggregate.recommendations)];

    return aggregate;
  }
}
