import { IReasoningEngine, PlanningResponse } from './types';
import { Workflow } from '../workflow/types';

export class RuleBasedReasoningEngine implements IReasoningEngine {
  async generatePlan(prompt: string): Promise<PlanningResponse> {
    const goal = prompt.toLowerCase();

    // 1. Process Kill Rule
    if (goal.includes('kill') || goal.includes('terminate') || goal.includes('stop')) {
      return this.buildProcessKillWorkflow(goal);
    }

    // Fallback to Shell Execution Rule
    return this.buildShellFallbackWorkflow(goal);
  }

  private buildProcessKillWorkflow(goal: string): PlanningResponse {
    return {
      success: true,
      workflow: {
        id: 'rule-based-kill',
        name: 'Kill Process',
        version: '1.0',
        createdTime: new Date().toISOString(),
        metadata: {},
        variables: {},
        description: 'Kills a process based on name',
        steps: [
          {
            id: 'kill_step',
            type: 'ExecuteCapability',
            capabilityId: 'process.core',
            name: 'Kill Process',
            parameters: { operation: 'kill', command: 'target_process' },
            dependencies: []
          }
        ]
      },
      confidence: 90,
      risk: { level: 'SENSITIVE', score: 60, explanation: 'Killing processes can cause data loss.' },
      permissions: ['ProcessManagement']
    };
  }

  private buildShellFallbackWorkflow(goal: string): PlanningResponse {
    return {
      success: true,
      workflow: {
        id: 'rule-based-shell',
        name: 'Execute Shell Command',
        version: '1.0',
        createdTime: new Date().toISOString(),
        metadata: {},
        variables: {},
        description: 'Runs a generic shell command',
        steps: [
          {
            id: 'shell_step',
            type: 'ExecuteCapability',
            capabilityId: 'shell.core',
            name: 'Shell Command',
            parameters: { command: 'echo "Fallback Executed"' },
            dependencies: []
          }
        ]
      },
      confidence: 50,
      risk: { level: 'UNKNOWN', score: 50, explanation: 'Executing arbitrary shell commands is risky.' },
      permissions: ['ShellExecution']
    };
  }
}
