/**
 * ExecutionPreview.ts — Read-only generator summarizing planned actions and risks
 */

export interface ExecutionSummary {
  readonly actionsCount: number;
  readonly estimatedDurationMs: number;
  readonly riskLevel: 'Low' | 'Medium' | 'High';
  readonly permissionsRequired: string[];
  readonly rollbackAvailable: boolean;
  readonly description: string;
}

export class ExecutionPreview {
  public generateSummary(plan: any): ExecutionSummary {
    // In a real system, this inspects the DAG from the Planner
    const actionsCount = plan?.actions?.length || 0;
    
    return {
      actionsCount,
      estimatedDurationMs: actionsCount * 500, // naive estimate
      riskLevel: actionsCount > 5 ? 'High' : (actionsCount > 2 ? 'Medium' : 'Low'),
      permissionsRequired: ['filesystem.read'], // mock
      rollbackAvailable: true,
      description: `Planned execution of ${actionsCount} actions.`
    };
  }
}
