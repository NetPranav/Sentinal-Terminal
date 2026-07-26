import { test, expect, describe, vi } from 'vitest';
import { AgentRuntime } from './AgentRuntime';
import { WorkflowEngine } from '../workflow/WorkflowEngine';
import { ExecutionEngine } from '../security/ExecutionEngine';
import { Planner } from '../planner/Planner';
import { CapabilityManager, CapabilityRegistry } from '../Capability';
import { Workflow, WorkflowStep } from '../workflow/types';

describe('AgentRuntime', () => {
  test('executes a workflow successfully', async () => {
    const workflowEngine = new WorkflowEngine();
    const executionEngine = {
      execute: vi.fn().mockResolvedValue({ success: true, data: 'test output' })
    } as any;
    const planner = {} as any;

    const workflow: Workflow = {
      id: 'wf1',
      name: 'Test Workflow',
      version: '1.0',
      createdTime: new Date().toISOString(),
      variables: {},
      steps: [
        {
          id: 'step1',
          name: 'Step 1',
          type: 'ExecuteCapability',
          capabilityId: 'fs.read',
          dependencies: []
        }
      ]
    };

    const runtime = new AgentRuntime(workflowEngine, executionEngine, planner, workflow);
    
    const events: string[] = [];
    runtime.on((e) => events.push(e));

    const summary = await runtime.start();

    expect(summary.finalResult).toBe('Success');
    expect(summary.completedSteps).toContain('step1');
    expect(events).toContain('WorkflowStarted');
    expect(events).toContain('StepStarted');
    expect(events).toContain('StepCompleted');
    expect(events).toContain('WorkflowCompleted');
  });

  test('handles retries on transient failures', async () => {
    const workflowEngine = new WorkflowEngine();
    let fails = 0;
    const executionEngine = {
      execute: vi.fn().mockImplementation(async () => {
        if (fails < 2) {
          fails++;
          return { success: false, error: { message: 'Network timeout' } };
        }
        return { success: true, data: 'success' };
      })
    } as any;
    const planner = {} as any;

    const workflow: Workflow = {
      id: 'wf2',
      name: 'Retry Workflow',
      version: '1.0',
      createdTime: new Date().toISOString(),
      variables: {},
      steps: [
        {
          id: 'step1',
          name: 'Flaky Step',
          type: 'ExecuteCapability',
          capabilityId: 'net.download',
          dependencies: [],
          retryPolicy: {
            type: 'fixed',
            maxAttempts: 3,
            delayMs: 10
          }
        }
      ]
    };

    const runtime = new AgentRuntime(workflowEngine, executionEngine, planner, workflow);
    
    const summary = await runtime.start();

    expect(summary.finalResult).toBe('Success');
    expect(summary.retries['step1']).toBe(2);
  });
});
