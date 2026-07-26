import { WorkflowEngine } from '../workflow/WorkflowEngine';
import { ExecutionEngine, ExecutionPreviewPlan } from '../security/ExecutionEngine';
import { Planner } from '../planner/Planner';
import { Workflow, WorkflowStep } from '../workflow/types';
import { AgentExecutionState, AgentEvent, ExecutionSummary } from './types';
import { RetryEngine } from './RetryEngine';

type AgentEventListener = (event: AgentEvent, payload?: any) => void;

export class AgentRuntime {
  private state: AgentExecutionState;
  private workflow: Workflow;
  private listeners: AgentEventListener[] = [];
  private cancelToken: boolean = false;
  private pauseToken: boolean = false;

  private repairCount = 0;

  constructor(
    private workflowEngine: WorkflowEngine,
    private executionEngine: ExecutionEngine,
    private planner: any,
    workflow: Workflow
  ) {
    this.workflow = workflow;
    this.state = {
      workflowId: workflow.id,
      status: 'IDLE',
      completedSteps: [],
      failedSteps: [],
      retries: {},
      startTime: 0,
      logs: []
    };
  }

  public on(listener: AgentEventListener) {
    this.listeners.push(listener);
  }

  private emit(event: AgentEvent, payload?: any) {
    this.listeners.forEach(l => l(event, payload));
    if (payload?.log) {
      this.state.logs.push(`[${new Date().toISOString()}] ${payload.log}`);
    }
  }

  public async start(): Promise<ExecutionSummary> {
    this.state.status = 'RUNNING';
    this.state.startTime = performance.now();
    this.cancelToken = false;
    this.pauseToken = false;
    
    this.emit('WorkflowStarted', { log: `Workflow ${this.workflow.name} started.` });
    this.workflowEngine.startWorkflow(this.workflow);
    
    return this.executionLoop();
  }

  public pause() {
    this.pauseToken = true;
    this.state.status = 'PAUSED';
    this.emit('WorkflowPaused', { log: 'Workflow paused.' });
  }

  public async resume(): Promise<ExecutionSummary> {
    if (this.state.status !== 'PAUSED') throw new Error("Cannot resume, not paused.");
    this.pauseToken = false;
    this.state.status = 'RUNNING';
    this.emit('WorkflowResumed', { log: 'Workflow resumed.' });
    return this.executionLoop();
  }

  public cancel() {
    this.cancelToken = true;
    this.state.status = 'CANCELLED';
    this.emit('WorkflowCancelled', { log: 'Workflow cancelled.' });
  }

  private async executionLoop(): Promise<ExecutionSummary> {
    while (this.state.status === 'RUNNING') {
      if (this.cancelToken) {
        this.state.status = 'CANCELLED';
        break;
      }
      if (this.pauseToken) {
        return this.generateSummary();
      }

      // 1. Get next tasks
      const tasks = this.workflowEngine.getNextTasks(this.workflow.id);
      
      // Check if workflow is complete (no tasks pending or running, all completed)
      if (tasks.length === 0) {
        const allExecs = this.workflowEngine.getExecutionState(this.workflow.id);
        const hasPendingOrRunning = Array.from(allExecs?.values() || []).some(e => e.status === 'PENDING' || e.status === 'RUNNING');
        
        if (!hasPendingOrRunning) {
          // Success!
          this.state.status = 'COMPLETED';
          this.emit('WorkflowCompleted', { log: 'Workflow completed successfully.' });
          break;
        } else {
          // Wait for running tasks to finish (simple delay since we're simulating concurrent execution here, though we run sequentially in this loop for now)
          await new Promise(r => setTimeout(r, 100));
          continue;
        }
      }

      // For simplicity in AgentRuntime, we execute sequentially (even parallel nodes can be sequential if we block)
      // A more complex implementation would spawn Promises and await Promise.all
      const step = tasks[0]; 
      
      this.state.currentStepId = step.id;
      this.emit('StepStarted', { log: `Executing step ${step.name}...`, step });
      
      this.workflowEngine.markTaskRunning(this.workflow.id, step.id);

      const success = await this.executeStepWithRetry(step);

      if (!success) {
        this.state.status = 'FAILED';
        this.emit('WorkflowFailed', { log: `Workflow failed at step ${step.name}` });
        break;
      }
    }

    return this.generateSummary();
  }

  private async executeStepWithRetry(step: WorkflowStep): Promise<boolean> {
    let attempt = 0;
    
    while (true) {
      if (this.cancelToken || this.pauseToken) return false;

      let result;
      try {
        if (step.type === 'ExecuteCapability') {
          // 2. Execution (and internal verification via ExecutionEngine)
          this.emit('VerificationStarted', { step });
          
          const input = this.workflowEngine.interpolate(this.workflow.id, step.parameters || {});
          
          result = await this.executionEngine.execute(step.capabilityId!, input, {
            onAskPermission: async (plan: ExecutionPreviewPlan) => {
              this.emit('ApprovalRequested', { plan });
              // Simple mock approval for now, real UI would resolve a promise
              this.emit('ApprovalGranted', { log: 'Approval granted by user.' });
              return true;
            }
          });

          if (result.success) {
            this.emit('VerificationPassed', { step });
            this.workflowEngine.markTaskComplete(this.workflow.id, step, result.data, result.rollbackAction);
            this.state.completedSteps.push(step.id);
            this.emit('StepCompleted', { step, data: result.data });
            return true;
          } else {
            this.emit('VerificationFailed', { step, error: result.error });
            throw new Error(result.error?.message || 'Execution failed');
          }
        } else if (step.type === 'Delay') {
           await new Promise(r => setTimeout(r, step.delayMs || 1000));
           this.workflowEngine.markTaskComplete(this.workflow.id, step, null);
           this.state.completedSteps.push(step.id);
           this.emit('StepCompleted', { step });
           return true;
        } else {
          // Handle variable assignment, conditionals directly via WorkflowEngine state
          this.workflowEngine.markTaskComplete(this.workflow.id, step, null);
          this.state.completedSteps.push(step.id);
          this.emit('StepCompleted', { step });
          return true;
        }
      } catch (err: any) {
        // 3. Retry Logic
        if (RetryEngine.shouldRetry(step.retryPolicy, attempt)) {
          attempt++;
          this.state.retries[step.id] = attempt;
          this.emit('RetryStarted', { log: `Retrying step ${step.name} (Attempt ${attempt})...`, step });
          await RetryEngine.waitDelay(step.retryPolicy!, attempt);
          continue;
        }

        this.emit('RetryFailed', { log: `Retries exhausted for step ${step.name}.`, step });
        this.workflowEngine.markTaskFailed(this.workflow.id, step.id, err.message);
        this.state.failedSteps.push(step.id);

        // 4. Planner Repair
        return await this.attemptPlannerRepair(step, err.message);
      }
    }
  }

  private async attemptPlannerRepair(failedStep: WorkflowStep, _errorMsg: string): Promise<boolean> {
    this.emit('PlannerRepairRequested', { log: `Requesting planner repair for step ${failedStep.name}...` });
    
    if (this.repairCount >= 3) {
      this.emit('WorkflowFailed', { log: 'Max planner repairs exceeded.' });
      return false;
    }
    
    try {
      // remainingSteps could be used to pass to the planner
      const _remainingSteps = this.workflow.steps.filter(s => 
        !this.state.completedSteps.includes(s.id) && s.id !== failedStep.id
      );

      // In real code, we would call the repair API of the Planner:
      // const repairResponse = await this.planner.repairPlan(...)
      // Since Planner API is simplified, we mock the result for now:
      
      this.repairCount++;
      await new Promise(r => setTimeout(r, 1500)); // Simulate LLM latency
      
      this.emit('PlannerRepairCompleted', { log: 'Planner provided a patched workflow segment.' });
      
      // Inject dummy repaired step (in reality, inject the steps from planner)
      const repairedStep: WorkflowStep = {
        ...failedStep,
        id: failedStep.id + '_repaired',
        name: failedStep.name + ' (Repaired)',
        retryPolicy: { type: 'none', maxAttempts: 0, delayMs: 0 }
      };
      
      this.workflowEngine.injectSteps(this.workflow.id, [repairedStep]);
      
      // Continue execution on the repaired step
      return await this.executeStepWithRetry(repairedStep);
      
    } catch (e) {
      this.emit('WorkflowFailed', { log: 'Planner repair failed.' });
      return false;
    }
  }

  private generateSummary(): ExecutionSummary {
    this.state.endTime = performance.now();
    return {
      goal: this.workflow.name,
      completedSteps: this.state.completedSteps,
      skippedSteps: [], // Handled by WorkflowEngine internally
      failedSteps: this.state.failedSteps,
      retries: this.state.retries,
      repairCount: this.repairCount,
      executionTimeMs: this.state.endTime - this.state.startTime,
      warnings: [],
      finalResult: this.state.status === 'COMPLETED' ? 'Success' : (this.state.status === 'CANCELLED' ? 'Cancelled' : 'Failed')
    };
  }
}
