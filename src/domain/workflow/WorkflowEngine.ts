import { Workflow, WorkflowStep, WorkflowTaskExecution } from './types';
import { VariableEngine } from './VariableEngine';

export class WorkflowEngine {
  private variables = new VariableEngine();
  
  // Track state of active workflows
  private executions: Map<string, Map<string, WorkflowTaskExecution>> = new Map();
  private workflowVariables: Map<string, Record<string, any>> = new Map();
  private workflows: Map<string, Workflow> = new Map();

  public startWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
    this.executions.set(workflow.id, new Map());
    this.workflowVariables.set(workflow.id, { ...workflow.variables });

    // Initialize all steps as PENDING
    const execMap = this.executions.get(workflow.id)!;
    for (const step of workflow.steps) {
      execMap.set(step.id, { stepId: step.id, status: 'PENDING' });
    }
  }

  public getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  public getExecutionState(workflowId: string): WorkflowTaskExecution[] | undefined {
    const map = this.executions.get(workflowId);
    return map ? Array.from(map.values()) : undefined;
  }

  public cancelWorkflow(workflowId: string): void {
    const execs = this.executions.get(workflowId);
    if (execs) {
      execs.forEach(exec => {
        if (exec.status === 'PENDING' || exec.status === 'RUNNING') {
          exec.status = 'CANCELLED';
        }
      });
    }
  }

  public getVariables(workflowId: string): Record<string, any> | undefined {
    return this.workflowVariables.get(workflowId);
  }

  /**
   * Evaluates the DAG and returns steps that are PENDING and have all dependencies COMPLETED.
   */
  public getNextTasks(workflowId: string): WorkflowStep[] {
    const workflow = this.workflows.get(workflowId);
    const execMap = this.executions.get(workflowId);
    if (!workflow || !execMap) return [];

    const readySteps: WorkflowStep[] = [];

    for (const step of workflow.steps) {
      const exec = execMap.get(step.id);
      if (!exec || exec.status !== 'PENDING') continue;

      let canRun = true;
      if (step.dependencies && step.dependencies.length > 0) {
        canRun = step.dependencies.every(depId => {
          const depExec = execMap.get(depId);
          return depExec && depExec.status === 'COMPLETED';
        });
      }

      if (canRun) {
        readySteps.push(step);
      }
    }

    return readySteps;
  }

  public interpolate(workflowId: string, data: any): any {
    const currentVars = this.workflowVariables.get(workflowId);
    if (!currentVars) return data;
    return this.variables.interpolate(data, currentVars);
  }

  public markTaskRunning(workflowId: string, stepId: string): void {
    const exec = this.executions.get(workflowId)?.get(stepId);
    if (exec && exec.status === 'PENDING') {
      exec.status = 'RUNNING';
      exec.startTime = performance.now();
    }
  }

  public markTaskComplete(workflowId: string, step: WorkflowStep, output: any, rollbackAction?: any): void {
    const exec = this.executions.get(workflowId)?.get(step.id);
    const currentVars = this.workflowVariables.get(workflowId);
    
    if (exec && currentVars) {
      exec.status = 'COMPLETED';
      exec.endTime = performance.now();
      if (exec.startTime) exec.durationMs = exec.endTime - exec.startTime;
      exec.output = output;
      exec.rollbackAction = rollbackAction;

      // Handle standard outputs
      currentVars['_stepOutput'] = currentVars['_stepOutput'] || {};
      currentVars['_stepOutput'][step.id] = output;

      // Special logic for VariableAssignment step
      if (step.type === 'VariableAssignment' && step.assignments) {
        for (const [k, v] of Object.entries(step.assignments)) {
          currentVars[k] = this.variables.interpolate(v, currentVars);
        }
      }

      // Special logic for ConditionalBranch
      if (step.type === 'ConditionalBranch' && step.condition) {
        const val = this.variables.interpolate(`{{${step.condition.variable}}}`, currentVars);
        const target = step.condition.value;
        
        let isTrue = false;
        switch(step.condition.operator) {
          case '==': isTrue = val === target; break;
          case '!=': isTrue = val !== target; break;
          case 'exists': isTrue = val !== undefined && val !== null; break;
        }

        const skippedStepId = isTrue ? step.falseBranch : step.trueBranch;
        
        if (skippedStepId) {
          // Cancel the branch that wasn't taken
          this.markTaskCancelled(workflowId, skippedStepId);
          // And cascade cancel everything that depends on it
          this.cascadeCancel(workflowId, skippedStepId);
        }
      }
    }
  }

  public markTaskFailed(workflowId: string, stepId: string, error: any): void {
    const exec = this.executions.get(workflowId)?.get(stepId);
    if (exec) {
      exec.status = 'FAILED';
      exec.error = error;
      exec.endTime = performance.now();
      if (exec.startTime) exec.durationMs = exec.endTime - exec.startTime;
    }
  }

  public markTaskCancelled(workflowId: string, stepId: string): void {
    const exec = this.executions.get(workflowId)?.get(stepId);
    if (exec && exec.status !== 'COMPLETED' && exec.status !== 'FAILED') {
      exec.status = 'CANCELLED';
      exec.endTime = performance.now();
    }
  }

  private cascadeCancel(workflowId: string, stepId: string) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;
    
    // Find steps that depend on stepId and cancel them
    for (const step of workflow.steps) {
      if (step.dependencies && step.dependencies.includes(stepId)) {
        this.markTaskCancelled(workflowId, step.id);
        this.cascadeCancel(workflowId, step.id);
      }
    }
  }

  /**
   * Mutates the workflow by replacing/adding steps. Used by AI Planner Repair.
   */
  public injectSteps(workflowId: string, newSteps: WorkflowStep[]): void {
    const workflow = this.workflows.get(workflowId);
    const execMap = this.executions.get(workflowId);
    if (!workflow || !execMap) return;

    for (const step of newSteps) {
      // Replace if exists, or append
      const existingIdx = workflow.steps.findIndex(s => s.id === step.id);
      if (existingIdx >= 0) {
        workflow.steps[existingIdx] = step;
      } else {
        workflow.steps.push(step);
      }
      
      // Reset execution state to PENDING
      execMap.set(step.id, { stepId: step.id, status: 'PENDING' });
    }
  }
}
