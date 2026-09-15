import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeterministicReplayEngine } from './DeterministicReplayEngine';
import { SavedWorkflowDefinition } from '../models/WorkflowTypes';
import { UndoLog } from '../../domain/session/UndoLog';

describe('DeterministicReplayEngine', () => {
  let engine: DeterministicReplayEngine;

  beforeEach(() => {
    engine = new DeterministicReplayEngine();
    UndoLog.getInstance().clear();
    vi.restoreAllMocks();
  });

  it('parses CLI flag parameter overrides correctly', () => {
    const parsed = engine.parseCliOverrides('--port=9000 --tag=v2.0 --dry-run --env=staging');
    expect(parsed['PORT']).toBe(9000);
    expect(parsed['TAG']).toBe('v2.0');
    expect(parsed['DRY_RUN']).toBe(true);
    expect(parsed['ENV']).toBe('staging');

    // Space-separated flags
    const spaceParsed = engine.parseCliOverrides(['--port', '8081', '-t', 'beta']);
    expect(spaceParsed['PORT']).toBe(8081);
    expect(spaceParsed['T']).toBe('beta');
  });

  it('substitutes parameter variables in command strings and paths', () => {
    const templateCmd = 'curl -f http://localhost:{{PORT}}/api/{{TAG}}/health';
    const substituted = engine.substituteParameters(templateCmd, {
      PORT: 9000,
      TAG: 'v1.5'
    });
    expect(substituted).toBe('curl -f http://localhost:9000/api/v1.5/health');

    // Shell style $PORT
    const shellCmd = 'docker run -p $PORT:8080 my-app:${TAG}';
    const shellSub = engine.substituteParameters(shellCmd, {
      PORT: 8080,
      TAG: 'latest'
    });
    expect(shellSub).toBe('docker run -p 8080:8080 my-app:latest');
  });

  it('replays a saved workflow sequentially without LLM inference', async () => {
    const executedCommands: string[] = [];

    const mockWorkflow: SavedWorkflowDefinition = {
      schemaVersion: 1,
      name: 'build-and-deploy',
      steps: [
        { id: '1', name: 'Build', command: 'npm run build' },
        { id: '2', name: 'Deploy', command: 'npm run deploy -- --port={{PORT}}' }
      ],
      parameters: [
        { name: 'PORT', type: 'port', description: 'Port', required: false, defaultValue: 3000 }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const mockExecutor = async (cmd: string) => {
      executedCommands.push(cmd);
      return { code: 0, stdout: 'OK', stderr: '' };
    };

    const result = await engine.replay(mockWorkflow, {
      parameters: { PORT: 9000 },
      autoApprove: true,
      executor: mockExecutor
    });

    expect(result.success).toBe(true);
    expect(result.stepsExecuted).toBe(2);
    expect(executedCommands).toEqual([
      'npm run build',
      'npm run deploy -- --port=9000'
    ]);

    // Verify actions logged in UndoLog
    const recent = UndoLog.getInstance().getRecentActions();
    expect(recent).toHaveLength(2);
    expect(recent[0].command).toContain('npm run deploy');
  });

  it('handles dry-run mode without executing destructive commands', async () => {
    const mockWorkflow: SavedWorkflowDefinition = {
      schemaVersion: 1,
      name: 'clean-workflow',
      steps: [
        { id: '1', name: 'Clean build', command: 'rm -rf target/ dist/', isDestructive: true },
        { id: '2', name: 'Verify', command: 'ls -la' }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const executorSpy = vi.fn();

    const result = await engine.replay(mockWorkflow, {
      dryRun: true,
      executor: executorSpy
    });

    expect(result.success).toBe(true);
    expect(result.stepResults[0].status).toBe('skipped_dry_run');
    expect(result.stepResults[0].stdout).toContain('[DRY-RUN] Would execute');
    expect(executorSpy).not.toHaveBeenCalled();
  });

  it('detects and flags environment drift when required ports are invalid', async () => {
    const mockWorkflow: SavedWorkflowDefinition = {
      schemaVersion: 1,
      name: 'server-workflow',
      steps: [{ id: '1', name: 'Run server', command: 'node server.js' }],
      environmentPrerequisites: {
        requiredPorts: [8080]
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Passing invalid port 999999
    const result = await engine.replay(mockWorkflow, {
      parameters: { PORT: 999999 }
    });

    expect(result.success).toBe(false);
    expect(result.environmentValidation.passed).toBe(false);
    expect(result.error).toContain('Invalid port override');
  });

  it('aborts workflow execution when a step fails', async () => {
    const mockWorkflow: SavedWorkflowDefinition = {
      schemaVersion: 1,
      name: 'failing-pipeline',
      steps: [
        { id: '1', name: 'Step 1', command: 'echo first' },
        { id: '2', name: 'Failing Step', command: 'exit 2' },
        { id: '3', name: 'Step 3', command: 'echo should not run' }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const mockExecutor = async (cmd: string) => {
      if (cmd === 'exit 2') {
        return { code: 2, stdout: '', stderr: 'Command failed' };
      }
      return { code: 0, stdout: 'ok', stderr: '' };
    };

    const result = await engine.replay(mockWorkflow, {
      autoApprove: true,
      executor: mockExecutor
    });

    expect(result.success).toBe(false);
    expect(result.stepsExecuted).toBe(2); // Stopped at step 2
    expect(result.totalSteps).toBe(3);
    expect(result.stepResults[1].exitCode).toBe(2);
    expect(result.error).toContain('Step failed with exit code 2');
  });

  it('skips step when precondition passes and if_precondition_true is "skip" (Task 0.75.2)', async () => {
    const executedCommands: string[] = [];
    const mockWorkflow: SavedWorkflowDefinition = {
      schemaVersion: 1,
      name: 'precondition-skip-flow',
      steps: [
        {
          id: '1',
          name: 'Install Neovim',
          command: 'sudo pacman -S neovim',
          precondition_check: 'which nvim',
          if_precondition_true: 'skip',
          if_precondition_false: 'continue'
        },
        {
          id: '2',
          name: 'Open Neovim',
          command: 'nvim'
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const mockExecutor = async (cmd: string) => {
      executedCommands.push(cmd);
      if (cmd === 'which nvim') {
        return { code: 0, stdout: '/usr/bin/nvim', stderr: '' };
      }
      return { code: 0, stdout: 'ok', stderr: '' };
    };

    const result = await engine.replay(mockWorkflow, {
      autoApprove: true,
      executor: mockExecutor
    });

    expect(result.success).toBe(true);
    expect(result.stepResults[0].status).toBe('skipped');
    // Verify pacman install was never run, but nvim command was run
    expect(executedCommands).not.toContain('sudo pacman -S neovim');
    expect(executedCommands).toContain('nvim');
  });

  it('aborts workflow when precondition fails and if_precondition_false is "abort" (Task 0.75.2)', async () => {
    const executedCommands: string[] = [];
    const mockWorkflow: SavedWorkflowDefinition = {
      schemaVersion: 1,
      name: 'precondition-abort-flow',
      steps: [
        {
          id: '1',
          name: 'Build Frontend',
          command: 'npm run build',
          precondition_check: 'test -f package.json',
          if_precondition_true: 'continue',
          if_precondition_false: 'abort'
        },
        {
          id: '2',
          name: 'Deploy',
          command: 'npm run deploy'
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const mockExecutor = async (cmd: string) => {
      executedCommands.push(cmd);
      if (cmd === 'test -f package.json') {
        return { code: 1, stdout: '', stderr: 'No such file' };
      }
      return { code: 0, stdout: 'ok', stderr: '' };
    };

    const result = await engine.replay(mockWorkflow, {
      autoApprove: true,
      executor: mockExecutor
    });

    expect(result.success).toBe(false);
    expect(result.stepResults[0].status).toBe('failed');
    expect(result.error).toContain('package.json');
    expect(executedCommands).not.toContain('npm run build');
    expect(executedCommands).not.toContain('npm run deploy');
  });
});
