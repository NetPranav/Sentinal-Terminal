/**
 * AdaptivePlanEngine.ts — Dynamic Adaptive Multi-Phase Planning & Execution Engine
 * 
 * Core AI architecture for:
 * 1. Structuring user requests into explicit hierarchical execution phases (Phase 1, Phase 2, etc.)
 * 2. Executing phases sequentially 1 by 1
 * 3. Real-time plan adaptation:
 *    - Early Goal Completion: If the goal is fulfilled early (e.g. at Phase 2 of 5),
 *      remaining phases (3-5) are marked as 'skipped' and execution finishes early.
 *    - Dynamic Sub-Phase Expansion: If a phase requires sub-tasks or uncovers prerequisites,
 *      it dynamically injects sub-phases (e.g. Phase 2.1, Phase 2.2) and executes them.
 * 4. Pluggable design supporting both small local models and future frontier cloud AI APIs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ErrorDiagnosticsEngine, DiagnosticResult } from './ErrorDiagnosticsEngine';
import { ProjectDiscoveryEngine, DiscoveredProject, FileSystemScanner } from '../../domain/discovery/ProjectDiscoveryEngine';

export type PhaseStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed' | 'awaiting_action';

export interface PlanPhase {
  /** Hierarchical identifier: e.g. "1", "2", "2.1", "2.2", "3" */
  id: string;
  /** Human-readable title of the phase */
  title: string;
  /** Detailed description or intent */
  description?: string;
  /** Current execution status */
  status: PhaseStatus;
  /** Suggested or mapped tool */
  tool?: string;
  /** Parameters for the tool */
  params?: Record<string, any>;
  /** Nested sub-phases dynamically injected during execution */
  subPhases?: PlanPhase[];
  /** Outcome summary once executed */
  resultSummary?: string;
  /** Reason for skipping if skipped */
  skippedReason?: string;
}

export interface AgentPlan {
  summary: string;
  /** Linear steps array maintained for backward compatibility */
  steps: string[];
  /** Hierarchical phase structure */
  phases: PlanPhase[];
  /** Currently executing phase ID */
  activePhaseId?: string;
  /** Optional clarification question */
  question?: string;
  /** Discovered candidate projects for disambiguation */
  discoveredProjects?: DiscoveredProject[];
}

export interface PhaseExecutionStep {
  phaseId: string;
  tool: string;
  params: Record<string, any>;
  result: {
    success: boolean;
    data?: any;
    error?: string;
    stdout?: string;
    stderr?: string;
  };
}

export interface AdaptiveExecutionOptions {
  cwd: string;
  os: string;
  onPlanUpdate?: (plan: AgentPlan) => void;
  onPhaseStart?: (phase: PlanPhase) => void;
  onPhaseDone?: (phase: PlanPhase) => void;
  onStepOutput?: (output: string) => void;
  onPhysicalActionRequired?: (action: { prompt: string; cause: string; phaseId: string }) => Promise<boolean>;
  toolExecutor: {
    execute: (toolId: string, params: any, cwd?: string, authHandler?: any) => Promise<any>;
    hasDriver: (toolId: string) => boolean;
  };
  authorizationHandler?: any;
}

export interface PlannerModelProvider {
  generate(prompt: string, modelId?: string, options?: any): Promise<{ content: string }>;
}

export class AdaptivePlanEngine {
  constructor(private modelProvider?: PlannerModelProvider, private modelId?: string) {}

  /**
   * Generates a structured multi-phase execution plan from the user's goal.
   */
  public async createPlan(
    goal: string,
    context: { os: string; cwd: string }
  ): Promise<AgentPlan> {
    // 1. Try fast deterministic heuristic planning first
    const heuristic = this.createHeuristicPhases(goal, context);
    if (heuristic) {
      return heuristic;
    }

    // 2. Try Project & Workspace Discovery Probe (e.g. "run gazebo", "launch node", "run rover")
    const discoveredPlan = await this.probeProjectWorkspaces(goal, context);
    if (discoveredPlan) {
      return discoveredPlan;
    }

    // 2. Fall back to model-based planning if provider is available
    if (this.modelProvider && this.modelId) {
      try {
        const prompt = this.buildPhasePlanningPrompt(goal, context);
        const res = await this.modelProvider.generate(prompt, this.modelId, {
          temperature: 0,
          maxTokens: 350,
          format: 'json'
        });
        const parsed = this.parsePlanResponse(res.content, goal);
        if (parsed) return parsed;
      } catch (err) {
        console.warn('[AdaptivePlanEngine] Model planning failed, falling back to default plan:', err);
      }
    }

    // 3. Fallback default single/two-phase plan
    return {
      summary: `Execute instruction: ${goal}`,
      steps: [goal],
      phases: [
        {
          id: '1',
          title: goal,
          status: 'pending'
        }
      ]
    };
  }

  /**
   * Executes the plan phase by phase (1 by 1) with real-time adaptation:
   * - Early completion skips remaining phases
   * - Prerequisites expand sub-phases (e.g. 2.1, 2.2)
   */
  public async executePlan(
    goal: string,
    plan: AgentPlan,
    options: AdaptiveExecutionOptions
  ): Promise<{ success: boolean; summary: string; steps: PhaseExecutionStep[]; cdPath?: string }> {
    const executedSteps: PhaseExecutionStep[] = [];
    let cdPath: string | undefined;

    options.onPlanUpdate?.(plan);

    for (let i = 0; i < plan.phases.length; i++) {
      const phase = plan.phases[i];

      // If phase was already skipped or completed, continue
      if (phase.status === 'skipped' || phase.status === 'completed') {
        continue;
      }

      // Check early goal completion before running next phase
      const earlyCheck = this.checkGoalSatisfaction(goal, executedSteps);
      if (earlyCheck.satisfied) {
        // Skip this and all remaining phases
        for (let j = i; j < plan.phases.length; j++) {
          plan.phases[j].status = 'skipped';
          plan.phases[j].skippedReason = `Goal fully achieved early: ${earlyCheck.reason || 'Complete'}`;
        }
        options.onPlanUpdate?.(plan);
        break;
      }

      // Mark current phase as running
      phase.status = 'running';
      plan.activePhaseId = phase.id;
      options.onPlanUpdate?.(plan);
      options.onPhaseStart?.(phase);

      // Execute this phase (and any sub-phases)
      const phaseOutcome = await this.executeSinglePhase(goal, phase, plan, options, executedSteps);
      if (phaseOutcome.cdPath) {
        cdPath = phaseOutcome.cdPath;
      }

      options.onPhaseDone?.(phase);
      options.onPlanUpdate?.(plan);

      // After completing phase, re-check if goal is already fully satisfied
      const postPhaseCheck = this.checkGoalSatisfaction(goal, executedSteps);
      if (postPhaseCheck.satisfied && i < plan.phases.length - 1) {
        for (let j = i + 1; j < plan.phases.length; j++) {
          if (plan.phases[j].status === 'pending') {
            plan.phases[j].status = 'skipped';
            plan.phases[j].skippedReason = `Goal fully achieved early: ${postPhaseCheck.reason || 'Complete'}`;
          }
        }
        options.onPlanUpdate?.(plan);
        break;
      }
    }

    plan.activePhaseId = undefined;
    options.onPlanUpdate?.(plan);

    const anySuccess = executedSteps.length === 0 || executedSteps.some(s => s.result.success);
    const completedPhases = plan.phases.filter(p => p.status === 'completed').length;
    const skippedPhases = plan.phases.filter(p => p.status === 'skipped').length;

    const summary = skippedPhases > 0
      ? `Completed goal in ${completedPhases} phase(s); ${skippedPhases} subsequent phase(s) skipped.`
      : `Successfully executed all ${completedPhases} phase(s) of workflow plan.`;

    return {
      success: anySuccess,
      summary,
      steps: executedSteps,
      cdPath
    };
  }

  /**
   * Executes a single phase. If sub-phases exist or are dynamically discovered, executes them.
   */
  private async executeSinglePhase(
    goal: string,
    phase: PlanPhase,
    plan: AgentPlan,
    options: AdaptiveExecutionOptions,
    executedSteps: PhaseExecutionStep[]
  ): Promise<{ success: boolean; cdPath?: string }> {
    let phaseCdPath: string | undefined;

    // Resolve tool and parameters if not already assigned
    if (!phase.tool) {
      const mapped = this.resolveToolForPhase(phase.title, goal, options.cwd);
      if (mapped) {
        phase.tool = mapped.tool;
        phase.params = mapped.params;
      }
    }

    // If tool is assigned, execute it
    if (phase.tool && options.toolExecutor.hasDriver(phase.tool)) {
      try {
        const result = await options.toolExecutor.execute(
          phase.tool,
          phase.params || {},
          options.cwd,
          options.authorizationHandler
        );

        const stepRecord: PhaseExecutionStep = {
          phaseId: phase.id,
          tool: phase.tool,
          params: phase.params || {},
          result
        };
        executedSteps.push(stepRecord);

        // Capture navigation
        if (phase.tool === 'filesystem.navigate' && result.success && phase.params?.path) {
          phaseCdPath = phase.params.path;
        }

        // Handle Physical Action Requirements (Human-in-the-Loop)
        if (!result.success) {
          const rawErr = [result.error, result.stderr, typeof result.data === 'string' ? result.data : result.data?.stderr].filter(Boolean).join(' ');
          const diag = ErrorDiagnosticsEngine.diagnose(rawErr, phase.tool, phase.params, options.cwd);

          if (diag.category === 'PHYSICAL_ACTION_REQUIRED') {
            phase.status = 'awaiting_action';
            plan.activePhaseId = phase.id;
            options.onPlanUpdate?.(plan);
            if (diag.physicalPrompt) {
              options.onStepOutput?.(diag.physicalPrompt);
            }

            if (options.onPhysicalActionRequired) {
              const confirmed = await options.onPhysicalActionRequired({
                prompt: diag.physicalPrompt || `⚠️ ${diag.cause}`,
                cause: diag.cause,
                phaseId: phase.id
              });

              if (confirmed) {
                options.onStepOutput?.(`✓ Action confirmed. Resuming execution of Phase ${phase.id}...`);
                const physicalRetry = await options.toolExecutor.execute(
                  phase.tool,
                  phase.params || {},
                  options.cwd,
                  options.authorizationHandler
                );
                executedSteps.push({
                  phaseId: `${phase.id}.post_confirmation`,
                  tool: phase.tool,
                  params: phase.params || {},
                  result: physicalRetry
                });
                phase.status = physicalRetry.success ? 'completed' : 'failed';
                phase.resultSummary = physicalRetry.success
                  ? (physicalRetry.data?.stdout || 'Phase completed after user confirmation')
                  : (physicalRetry.error || 'Phase execution failed after confirmation');
                return { success: physicalRetry.success, cdPath: phaseCdPath };
              }
            }
          }
        }

        // Check if execution indicates sub-phases are required (e.g. self-healing or prerequisite failure)
        const subSteps = this.detectSubPhasePrerequisites(phase, result, goal, options.cwd);
        if (subSteps && subSteps.length > 0) {
          // Dynamic Sub-Phase Expansion & Self-Healing
          this.injectSubPhases(phase, subSteps, plan, options);

          // Execute each injected sub-phase 1 by 1
          for (const sub of phase.subPhases || []) {
            sub.status = 'running';
            plan.activePhaseId = sub.id;
            options.onPlanUpdate?.(plan);
            options.onPhaseStart?.(sub);

            const subOutcome = await this.executeSinglePhase(goal, sub, plan, options, executedSteps);
            if (subOutcome.cdPath) phaseCdPath = subOutcome.cdPath;

            sub.status = subOutcome.success ? 'completed' : 'failed';
            options.onPhaseDone?.(sub);
            options.onPlanUpdate?.(plan);
          }

          // Retry the main phase tool action after sub-phases resolve prerequisites
          const retryResult = await options.toolExecutor.execute(
            phase.tool,
            phase.params || {},
            options.cwd,
            options.authorizationHandler
          );
          executedSteps.push({
            phaseId: `${phase.id}.retry`,
            tool: phase.tool,
            params: phase.params || {},
            result: retryResult
          });
          phase.status = retryResult.success ? 'completed' : 'failed';
          phase.resultSummary = retryResult.success
            ? (retryResult.data?.stdout || 'Completed via autonomous self-healing')
            : (retryResult.error || 'Failed after self-healing');
          return { success: retryResult.success, cdPath: phaseCdPath };
        }

        phase.status = result.success ? 'completed' : 'failed';
        phase.resultSummary = result.success ? (result.data?.stdout || 'Phase completed successfully') : (result.error || 'Phase execution failed');
        return { success: result.success, cdPath: phaseCdPath };

      } catch (err: any) {
        phase.status = 'failed';
        phase.resultSummary = err.message;
        return { success: false };
      }
    }

    // If no direct tool, mark completed as an informational/abstract phase
    phase.status = 'completed';
    phase.resultSummary = 'Completed';
    return { success: true };
  }

  /**
   * Injects sub-phases (e.g. Phase 2.1, 2.2) into a parent phase and updates the plan.
   */
  public injectSubPhases(
    parentPhase: PlanPhase,
    subPhasesData: { title: string; tool?: string; params?: Record<string, any> }[],
    plan: AgentPlan,
    options?: AdaptiveExecutionOptions
  ): void {
    if (!parentPhase.subPhases) {
      parentPhase.subPhases = [];
    }

    subPhasesData.forEach((sub, idx) => {
      const subId = `${parentPhase.id}.${idx + 1}`;
      const newSubPhase: PlanPhase = {
        id: subId,
        title: sub.title,
        status: 'pending',
        tool: sub.tool,
        params: sub.params
      };
      parentPhase.subPhases!.push(newSubPhase);
    });

    // Update linear steps for backward compatibility
    plan.steps = this.flattenPlanSteps(plan.phases);
    options?.onPlanUpdate?.(plan);
  }

  /**
   * Checks if the overall user goal is already satisfied, enabling early termination.
   */
  public checkGoalSatisfaction(
    goal: string,
    executedSteps: PhaseExecutionStep[]
  ): { satisfied: boolean; reason?: string } {
    if (executedSteps.length === 0) return { satisfied: false };

    const lowerGoal = goal.toLowerCase();
    const lastStep = executedSteps[executedSteps.length - 1];

    // Bluetooth connection or enable goal
    if (lowerGoal.includes('bluetooth') || lowerGoal.includes('headphone') || lowerGoal.includes('airpods')) {
      if (lastStep.tool === 'network.bluetooth.connect' && lastStep.result.success) {
        return { satisfied: true, reason: 'Bluetooth target device successfully connected.' };
      }
      if ((lowerGoal.includes('turn on') || lowerGoal.includes('enable')) && lastStep.tool === 'network.bluetooth.on' && lastStep.result.success) {
        return { satisfied: true, reason: 'Bluetooth adapter successfully powered on.' };
      }
      if ((lowerGoal.includes('turn off') || lowerGoal.includes('disable')) && lastStep.tool === 'network.bluetooth.off' && lastStep.result.success) {
        return { satisfied: true, reason: 'Bluetooth adapter successfully turned off.' };
      }
    }

    // Wi-Fi toggle or connect
    if (lowerGoal.includes('wifi') || lowerGoal.includes('wi-fi')) {
      if ((lowerGoal.includes('turn on') || lowerGoal.includes('enable')) && lastStep.tool === 'network.wifi.on' && lastStep.result.success) {
        return { satisfied: true, reason: 'Wi-Fi interface enabled.' };
      }
      if (lastStep.tool === 'network.wifi.connect' && lastStep.result.success) {
        return { satisfied: true, reason: 'Wi-Fi network connection established.' };
      }
    }

    // Application launch / update
    if (lowerGoal.startsWith('open ') || lowerGoal.startsWith('launch ')) {
      if ((lastStep.tool === 'application.open' || lastStep.tool === 'browser.navigate') && lastStep.result.success) {
        return { satisfied: true, reason: 'Application opened successfully.' };
      }
    }

    if (lowerGoal.includes('update') && lastStep.tool === 'application.update' && lastStep.result.success) {
      return { satisfied: true, reason: 'Application upgrade completed.' };
    }

    // Filesystem directory navigation
    if (lastStep.tool === 'filesystem.navigate' && lastStep.result.success) {
      if (lowerGoal.includes('cd') || lowerGoal.includes('navigate') || lowerGoal.includes('go to')) {
        return { satisfied: true, reason: 'Destination directory reached.' };
      }
    }

    return { satisfied: false };
  }

  /**
   * Detects if an execution failure or status indicates that sub-phases must be spawned.
   */
  private detectSubPhasePrerequisites(
    phase: PlanPhase,
    result: any,
    goal: string,
    cwd?: string
  ): { title: string; tool?: string; params?: Record<string, any> }[] | null {
    // If the step succeeded without issues, no sub-phases needed
    if (result.success) return null;

    const rawErr = [result.error, result.stderr, typeof result.data === 'string' ? result.data : result.data?.stderr].filter(Boolean).join(' ');
    const diag = ErrorDiagnosticsEngine.diagnose(rawErr, phase.tool, phase.params, cwd);

    // If ErrorDiagnosticsEngine found an autonomous software remediation:
    if (diag.category === 'SOFTWARE_RECOVERABLE' && diag.remediation) {
      return [
        {
          title: diag.remediation.title,
          tool: diag.remediation.tool,
          params: diag.remediation.params
        }
      ];
    }

    const errMsg = rawErr.toLowerCase();

    // Case 1: Bluetooth connection failed because Bluetooth is off
    if (phase.tool === 'network.bluetooth.connect' && (errMsg.includes('power is off') || errMsg.includes('off') || errMsg.includes('disabled'))) {
      return [
        { title: 'Power on Bluetooth adapter', tool: 'network.bluetooth.on', params: {} },
        { title: 'Scan for target peripheral', tool: 'network.bluetooth.scan', params: {} }
      ];
    }

    // Case 2: Wi-Fi connection failed because Wi-Fi is off
    if (phase.tool === 'network.wifi.connect' && (errMsg.includes('hardware is off') || errMsg.includes('interface down'))) {
      return [
        { title: 'Power on Wi-Fi interface', tool: 'network.wifi.on', params: {} }
      ];
    }

    return null;
  }

  /**
   * Generates deterministic heuristic plans for standard common workflows.
   */
  private createHeuristicPhases(goal: string, context: { os: string; cwd: string }): AgentPlan | null {
    const lower = goal.toLowerCase().trim();

    // 1. Bluetooth device connection workflow (Multi-Phase)
    if (
      (lower.includes('connect') || lower.includes('pair')) &&
      (lower.includes('bluetooth') || lower.includes('headphone') || lower.includes('buds') || lower.includes('device') || lower.includes('space one'))
    ) {
      const match = goal.match(/(?:connect|pair)\s+(?:to\s+)?(?:bluetooth\s+)?(?:device\s+)?(.+)/i);
      const rawTarget = match ? match[1].replace(/\b(?:headphones?|earbuds?|headset|bluetooth|device)\b/gi, '').trim() : 'Bluetooth Device';
      const targetName = rawTarget || 'Bluetooth Device';

      return {
        summary: `Connect Bluetooth peripheral "${targetName}"`,
        steps: [
          'Verify Bluetooth adapter status',
          `Locate and connect to "${targetName}"`,
          'Verify audio & output routing'
        ],
        phases: [
          {
            id: '1',
            title: 'Verify Bluetooth adapter status',
            tool: 'network.bluetooth.on',
            status: 'pending'
          },
          {
            id: '2',
            title: `Locate and connect to "${targetName}"`,
            tool: 'network.bluetooth.connect',
            params: { device: targetName },
            status: 'pending'
          },
          {
            id: '3',
            title: 'Verify audio & output routing',
            status: 'pending'
          }
        ]
      };
    }

    // 2. Wi-Fi Connect Workflow (Multi-Phase)
    if (lower.startsWith('connect to wifi') || lower.startsWith('connect wifi')) {
      const match = lower.match(/connect\s+(?:to\s+)?(?:wifi|wi-fi)\s+(.+)/i);
      const ssid = match ? match[1].trim() : 'Wi-Fi Network';
      return {
        summary: `Connect to Wi-Fi network "${ssid}"`,
        steps: [
          'Enable Wi-Fi interface',
          `Establish connection to network "${ssid}"`,
          'Verify IP configuration and internet reachability'
        ],
        phases: [
          { id: '1', title: 'Enable Wi-Fi interface', tool: 'network.wifi.on', status: 'pending' },
          { id: '2', title: `Establish connection to network "${ssid}"`, tool: 'network.wifi.connect', params: { ssid }, status: 'pending' },
          { id: '3', title: 'Verify IP configuration and internet reachability', tool: 'network.ip', status: 'pending' }
        ]
      };
    }

    // 3. Application Update Workflow (Multi-Phase)
    if (lower.startsWith('update ') || lower.startsWith('upgrade ')) {
      const app = lower.replace(/^(?:update|upgrade)\s+/i, '').trim();
      return {
        summary: `Update application "${app}" via package manager`,
        steps: [
          `Inspect package status for "${app}"`,
          `Execute upgrade command for "${app}"`,
          'Verify updated application version'
        ],
        phases: [
          { id: '1', title: `Inspect package status for "${app}"`, status: 'pending' },
          { id: '2', title: `Execute upgrade command for "${app}"`, tool: 'application.update', params: { app }, status: 'pending' },
          { id: '3', title: 'Verify updated application version', status: 'pending' }
        ]
      };
    }

    // 4. Git Repository Setup / Pull Workflow (Multi-Phase)
    if (lower.startsWith('git sync') || lower.startsWith('pull latest changes')) {
      return {
        summary: 'Synchronize current git branch with remote repository',
        steps: [
          'Inspect git working directory status',
          'Fetch and pull remote changes',
          'Inspect commit log for new entries'
        ],
        phases: [
          { id: '1', title: 'Inspect git working directory status', tool: 'git.status', status: 'pending' },
          { id: '2', title: 'Fetch and pull remote changes', tool: 'git.pull', status: 'pending' },
          { id: '3', title: 'Inspect commit log for new entries', tool: 'git.log', status: 'pending' }
        ]
      };
    }

    // 5. System Service Orchestration (Multi-Phase)
    const serviceMatch = lower.match(/^(?:(start|stop|restart|enable|disable|status|check\s+status\s+of)\s+)?(?:service\s+)?([a-z0-9_.-]+)\s+service$/i)
      || lower.match(/^(?:(start|stop|restart|enable|disable)\s+service\s+([a-z0-9_.-]+))$/i);

    if (serviceMatch) {
      const actionRaw = (serviceMatch[1] || 'status').toLowerCase().replace(/check\s+status\s+of/i, 'status');
      const action = ['start', 'stop', 'restart', 'enable', 'disable', 'status'].includes(actionRaw) ? actionRaw : 'status';
      const service = (serviceMatch[2] || serviceMatch[1]).replace(/\s+service$/i, '').trim();

      return {
        summary: `${action.toUpperCase()} system service "${service}"`,
        steps: [
          `Inspect current service status for "${service}"`,
          `Execute ${action} operation on "${service}"`,
          `Verify service active state`
        ],
        phases: [
          { id: '1', title: `Inspect service status for "${service}"`, tool: 'system.service', params: { service, action: 'status' }, status: 'pending' },
          { id: '2', title: `Execute ${action} on "${service}"`, tool: 'system.service', params: { service, action }, status: 'pending' },
          { id: '3', title: `Verify service status for "${service}"`, tool: 'system.service', params: { service, action: 'status' }, status: 'pending' }
        ]
      };
    }

    // 6. Dotfile Rice & Autostart Orchestration
    const dotfileMatch = lower.match(/(?:turn\s+(on|off)|enable|disable)\s+([a-z0-9_.-]+)\s+(?:in\s+rice|on\s+startup|in\s+autostart|in\s+(hyprland|i3|sway))/i);
    if (dotfileMatch) {
      const enable = dotfileMatch[1] === 'on' || lower.startsWith('enable') || (!lower.includes('off') && !lower.includes('disable'));
      const app = dotfileMatch[2].trim();
      const targetHint = dotfileMatch[3] || 'hyprland';

      return {
        summary: `${enable ? 'Enable' : 'Disable'} "${app}" in ${targetHint} rice configuration`,
        steps: [
          `Inspect existing ${targetHint} configuration for "${app}"`,
          `${enable ? 'Enable' : 'Disable'} autostart directive for "${app}" with backup`,
          'Verify dotfile modification diff'
        ],
        phases: [
          {
            id: '1',
            title: `${enable ? 'Enable' : 'Disable'} "${app}" in ${targetHint} config`,
            tool: 'system.dotfile',
            params: { app, enable, target: targetHint },
            status: 'pending'
          }
        ]
      };
    }

    return null;
  }

  private buildPhasePlanningPrompt(goal: string, context: { os: string; cwd: string }): string {
    return `You are Sentinel's Core Workflow Planner on ${context.os}. Current directory: ${context.cwd}

Break the user request into 2 to 5 clear, sequential execution phases.
Return ONLY one valid JSON object formatted as:
{
  "summary": "Brief description of overall goal",
  "phases": [
    { "id": "1", "title": "Phase title", "tool": "optional.tool.id" },
    { "id": "2", "title": "Phase title", "tool": "optional.tool.id" }
  ]
}

User request: ${goal}`;
  }

  private parsePlanResponse(content: string, goal: string): AgentPlan | null {
    try {
      const clean = content.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(clean);
      if (!parsed || !Array.isArray(parsed.phases) || parsed.phases.length === 0) return null;

      const phases: PlanPhase[] = parsed.phases.map((p: any, idx: number) => ({
        id: String(p.id || idx + 1),
        title: String(p.title || `Phase ${idx + 1}`),
        tool: p.tool ? String(p.tool) : undefined,
        status: 'pending'
      }));

      return {
        summary: parsed.summary || goal,
        steps: phases.map(p => p.title),
        phases
      };
    } catch {
      return null;
    }
  }

  private resolveToolForPhase(phaseTitle: string, goal: string, cwd: string): { tool: string; params: any } | null {
    const lower = phaseTitle.toLowerCase();
    if (lower.includes('bluetooth') && (lower.includes('power on') || lower.includes('enable') || lower.includes('turn on'))) {
      return { tool: 'network.bluetooth.on', params: {} };
    }
    if (lower.includes('bluetooth') && (lower.includes('power off') || lower.includes('disable') || lower.includes('turn off'))) {
      return { tool: 'network.bluetooth.off', params: {} };
    }
    if (lower.includes('bluetooth') && (lower.includes('scan') || lower.includes('locate'))) {
      return { tool: 'network.bluetooth.scan', params: {} };
    }
    if (lower.includes('connect') && lower.includes('bluetooth')) {
      return { tool: 'network.bluetooth.connect', params: { device: goal } };
    }
    if (lower.includes('wifi') && (lower.includes('turn on') || lower.includes('enable'))) {
      return { tool: 'network.wifi.on', params: {} };
    }
    if (lower.includes('git') && lower.includes('status')) {
      return { tool: 'git.status', params: {} };
    }
    if (lower.includes('git') && lower.includes('pull')) {
      return { tool: 'git.pull', params: {} };
    }
    return null;
  }

  /**
   * Probe filesystem workspaces for project matching the goal keyword (e.g. "gazebo", "navigation").
   */
  public async probeProjectWorkspaces(
    goal: string,
    context: { os: string; cwd: string },
    scanner?: FileSystemScanner
  ): Promise<AgentPlan | null> {
    const match = goal.match(/^(?:run|launch|start|execute)\s+(?:my\s+|the\s+)?([a-z0-9_.-]+(?:\s+[a-z0-9_.-]+)*)$/i);
    if (!match) return null;

    const rawTarget = match[1].trim();
    const lowerTarget = rawTarget.toLowerCase();
    const commonIgnored = ['terminal', 'app', 'application', 'bluetooth', 'wifi', 'wi-fi', 'browser', 'server'];
    if (commonIgnored.includes(lowerTarget)) return null;

    const home = process.env.HOME || process.env.USERPROFILE || '';
    const searchRoots = [
      context.cwd,
      path.join(context.cwd, 'workspaces'),
      path.join(context.cwd, 'src'),
      path.join(home, 'workspaces'),
      path.join(home, 'ros_ws'),
      path.join(home, 'catkin_ws'),
      path.join(home, 'colcon_ws'),
      path.join(home, 'projects')
    ].filter(r => fs.existsSync(r) || scanner !== undefined);

    const probe = await ProjectDiscoveryEngine.probe(rawTarget, searchRoots, scanner);
    if (probe.matches.length === 0) return null;

    if (probe.disambiguationRequired) {
      return {
        summary: `Disambiguate project for "${rawTarget}"`,
        steps: [],
        phases: [],
        question: probe.disambiguationPrompt,
        discoveredProjects: probe.matches
      };
    }

    return this.createProjectExecutionPlan(probe.matches[0], rawTarget);
  }

  /**
   * Formulate a 3-phase execution plan for a discovered project workspace:
   * Phase 1: Navigate to project workspace
   * Phase 2: Source required environment setup script (if present)
   * Phase 3: Launch target binary / node
   */
  public createProjectExecutionPlan(proj: DiscoveredProject, targetKeyword: string): AgentPlan {
    const phases: PlanPhase[] = [
      {
        id: '1',
        title: `Navigate to workspace: ${proj.name}`,
        tool: 'filesystem.navigate',
        params: { path: proj.path },
        status: 'pending'
      }
    ];

    if (proj.setupScript) {
      phases.push({
        id: '2',
        title: `Source environment: ${proj.setupScript}`,
        tool: 'shell.execute',
        params: { command: proj.setupScript },
        status: 'pending'
      });
    }

    phases.push({
      id: `${phases.length + 1}`,
      title: `Launch ${proj.name}: ${proj.launchTarget || targetKeyword}`,
      tool: 'shell.execute',
      params: { command: proj.launchTarget || targetKeyword },
      status: 'pending'
    });

    return {
      summary: `Launch ${proj.description || proj.name} (${proj.type.toUpperCase()})`,
      steps: phases.map(p => p.title),
      phases
    };
  }

  private flattenPlanSteps(phases: PlanPhase[]): string[] {
    const list: string[] = [];
    for (const phase of phases) {
      list.push(phase.title);
      if (phase.subPhases) {
        for (const sub of phase.subPhases) {
          list.push(`  ↳ ${sub.title}`);
        }
      }
    }
    return list;
  }
}
