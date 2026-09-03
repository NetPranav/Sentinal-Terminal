import { describe, it, expect, vi } from 'vitest';
import { AdaptivePlanEngine, AgentPlan, PlanPhase } from './AdaptivePlanEngine';

describe('AdaptivePlanEngine — Dynamic Multi-Phase Planning & Execution', () => {
  it('should generate a multi-phase plan for composite user requests', async () => {
    const engine = new AdaptivePlanEngine();
    const plan = await engine.createPlan('connect bluetooth headphones Soundcore Space One', { os: 'mac', cwd: '/Users/test' });

    expect(plan).toBeDefined();
    expect(plan.phases.length).toBeGreaterThanOrEqual(3);
    expect(plan.phases[0].id).toBe('1');
    expect(plan.phases[0].title).toContain('Bluetooth');
    expect(plan.phases[1].id).toBe('2');
    expect(plan.phases[1].title).toContain('Soundcore Space One');
    expect(plan.phases[2].id).toBe('3');
  });

  it('should execute phases 1 by 1 and skip remaining phases upon early goal fulfillment', async () => {
    const engine = new AdaptivePlanEngine();
    const plan: AgentPlan = {
      summary: 'Connect Soundcore Space One Headphones',
      steps: ['Check Bluetooth status', 'Connect to Soundcore Space One', 'Verify audio routing', 'Configure volume balance'],
      phases: [
        { id: '1', title: 'Check Bluetooth status', tool: 'network.bluetooth.on', status: 'pending' },
        { id: '2', title: 'Connect to Soundcore Space One', tool: 'network.bluetooth.connect', params: { device: 'Soundcore Space One' }, status: 'pending' },
        { id: '3', title: 'Verify audio routing', tool: 'system.audio', status: 'pending' },
        { id: '4', title: 'Configure volume balance', tool: 'system.volume', status: 'pending' }
      ]
    };

    const mockToolExecutor = {
      hasDriver: vi.fn().mockReturnValue(true),
      execute: vi.fn().mockImplementation(async (toolId: string) => {
        if (toolId === 'network.bluetooth.on') {
          return { success: true, data: { poweredOn: true } };
        }
        if (toolId === 'network.bluetooth.connect') {
          // Goal fulfilled at Phase 2!
          return { success: true, data: { connected: true, device: 'Soundcore Space One' } };
        }
        return { success: true, data: {} };
      })
    };

    const phaseStarted: string[] = [];
    const phaseDone: string[] = [];

    const result = await engine.executePlan('connect bluetooth headphone Soundcore Space One', plan, {
      cwd: '/Users/test',
      os: 'mac',
      toolExecutor: mockToolExecutor,
      onPhaseStart: (p) => phaseStarted.push(p.id),
      onPhaseDone: (p) => phaseDone.push(p.id)
    });

    expect(result.success).toBe(true);
    // Phase 1 and 2 ran
    expect(phaseStarted).toEqual(['1', '2']);
    expect(plan.phases[0].status).toBe('completed');
    expect(plan.phases[1].status).toBe('completed');

    // Early Goal Satisfaction: Phase 3 and 4 were skipped!
    expect(plan.phases[2].status).toBe('skipped');
    expect(plan.phases[2].skippedReason).toContain('Goal fully achieved early');
    expect(plan.phases[3].status).toBe('skipped');

    // Tool for Phase 3 and Phase 4 was never executed
    expect(mockToolExecutor.execute).toHaveBeenCalledTimes(2);
    expect(result.summary).toContain('2 subsequent phase(s) skipped');
  });

  it('should dynamically inject and execute sub-phases (e.g. 2.1, 2.2) when prerequisites are discovered', async () => {
    const engine = new AdaptivePlanEngine();
    const plan: AgentPlan = {
      summary: 'Connect Bluetooth Device',
      steps: ['Initialize Bluetooth', 'Connect to target peripheral'],
      phases: [
        { id: '1', title: 'Initialize Bluetooth', tool: 'network.bluetooth.on', status: 'pending' },
        { id: '2', title: 'Connect to target peripheral', tool: 'network.bluetooth.connect', params: { device: 'Space One' }, status: 'pending' }
      ]
    };

    let connectAttempt = 0;
    const mockToolExecutor = {
      hasDriver: vi.fn().mockReturnValue(true),
      execute: vi.fn().mockImplementation(async (toolId: string) => {
        if (toolId === 'network.bluetooth.connect') {
          connectAttempt++;
          if (connectAttempt === 1) {
            // First attempt fails because Bluetooth power was unexpectedly off
            return { success: false, error: 'Bluetooth power is off' };
          }
          // After sub-phases resolve prerequisite, retry succeeds
          return { success: true, data: { connected: true, device: 'Space One' } };
        }
        if (toolId === 'network.bluetooth.on') {
          return { success: true, data: { poweredOn: true } };
        }
        if (toolId === 'network.bluetooth.scan') {
          return { success: true, data: { found: ['Space One'] } };
        }
        return { success: true, data: {} };
      })
    };

    const phaseStarted: string[] = [];
    const result = await engine.executePlan('connect bluetooth headphone Space One', plan, {
      cwd: '/Users/test',
      os: 'mac',
      toolExecutor: mockToolExecutor,
      onPhaseStart: (p) => phaseStarted.push(p.id)
    });

    expect(result.success).toBe(true);

    // Verify sub-phases were injected under Phase 2
    expect(plan.phases[1].subPhases).toBeDefined();
    expect(plan.phases[1].subPhases?.length).toBe(2);

    expect(plan.phases[1].subPhases![0].id).toBe('2.1');
    expect(plan.phases[1].subPhases![0].title).toBe('Power on Bluetooth adapter');
    expect(plan.phases[1].subPhases![0].status).toBe('completed');

    expect(plan.phases[1].subPhases![1].id).toBe('2.2');
    expect(plan.phases[1].subPhases![1].title).toBe('Scan for target peripheral');
    expect(plan.phases[1].subPhases![1].status).toBe('completed');

    // Both Phase 1, Phase 2, and sub-phases 2.1 & 2.2 executed
    expect(phaseStarted).toContain('1');
    expect(phaseStarted).toContain('2');
    expect(phaseStarted).toContain('2.1');
    expect(phaseStarted).toContain('2.2');
  });

  it('should support external / cloud AI API planners via pluggable PlannerModelProvider', async () => {
    // Simulate future cloud AI API (OpenAI / Claude / Gemini endpoint)
    const mockCloudAI = {
      generate: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          summary: 'Build and deploy production Next.js application',
          phases: [
            { id: '1', title: 'Audit and install dependencies', tool: 'shell.execute' },
            { id: '2', title: 'Compile and build production bundle', tool: 'shell.execute' },
            { id: '3', title: 'Run automated end-to-end test suite', tool: 'shell.execute' },
            { id: '4', title: 'Deploy container artifact', tool: 'docker.run' }
          ]
        })
      })
    };

    const cloudEngine = new AdaptivePlanEngine(mockCloudAI, 'gpt-4o');
    const plan = await cloudEngine.createPlan('build and deploy nextjs app', { os: 'mac', cwd: '/workspace' });

    expect(mockCloudAI.generate).toHaveBeenCalledOnce();
    expect(plan.phases.length).toBe(4);
    expect(plan.phases[0].id).toBe('1');
    expect(plan.phases[0].title).toBe('Audit and install dependencies');
    expect(plan.phases[3].id).toBe('4');
    expect(plan.phases[3].title).toBe('Deploy container artifact');
  });

  it('should autonomously self-heal software errors (e.g. EADDRINUSE port collision)', async () => {
    const engine = new AdaptivePlanEngine();
    const plan: AgentPlan = {
      summary: 'Launch local web service',
      steps: ['Start service on port 3000'],
      phases: [
        { id: '1', title: 'Start service on port 3000', tool: 'shell.execute', params: { command: 'node server.js' }, status: 'pending' }
      ]
    };

    let serverAttempts = 0;
    const mockToolExecutor = {
      hasDriver: vi.fn().mockReturnValue(true),
      execute: vi.fn().mockImplementation(async (toolId: string, params: any) => {
        if (toolId === 'shell.execute') {
          serverAttempts++;
          if (serverAttempts === 1) {
            // First attempt fails with EADDRINUSE port collision
            return {
              success: false,
              stderr: 'Error: listen EADDRINUSE: address already in use :::3000',
              error: 'Port 3000 is occupied'
            };
          }
          // After self-healing sub-phase frees port, second attempt succeeds!
          return { success: true, data: { stdout: 'Server listening on http://localhost:3000' } };
        }
        if (toolId === 'system.kill_process') {
          // Remediation sub-phase
          return { success: true, data: { stdout: 'Killed PID 4912 listening on port 3000' } };
        }
        return { success: true, data: {} };
      })
    };

    const outputLogs: string[] = [];
    const result = await engine.executePlan('start server', plan, {
      cwd: '/workspace',
      os: 'mac',
      toolExecutor: mockToolExecutor,
      onStepOutput: (out) => outputLogs.push(out)
    });

    expect(result.success).toBe(true);
    // Sub-phase 1.1 was automatically injected to free port 3000!
    expect(plan.phases[0].subPhases).toBeDefined();
    expect(plan.phases[0].subPhases?.length).toBe(1);
    expect(plan.phases[0].subPhases![0].id).toBe('1.1');
    expect(plan.phases[0].subPhases![0].title).toBe('Free port 3000');
    expect(plan.phases[0].subPhases![0].status).toBe('completed');

    // kill_process was called with port 3000
    expect(mockToolExecutor.execute).toHaveBeenCalledWith(
      'system.kill_process',
      { port: 3000 },
      '/workspace',
      undefined
    );

    // Shell execute was called twice (first failed, second succeeded)
    expect(serverAttempts).toBe(2);
    expect(plan.phases[0].status).toBe('completed');
  });

  it('should pause in awaiting_action for physical hardware confirmation and resume on user approval', async () => {
    const engine = new AdaptivePlanEngine();
    const plan: AgentPlan = {
      summary: 'Connect to offline hardware peripheral',
      steps: ['Connect to USB device'],
      phases: [
        { id: '1', title: 'Connect to USB device', tool: 'shell.execute', params: { command: 'flash-firmware' }, status: 'pending' }
      ]
    };

    let flashAttempts = 0;
    const mockToolExecutor = {
      hasDriver: vi.fn().mockReturnValue(true),
      execute: vi.fn().mockImplementation(async (toolId: string) => {
        if (toolId === 'shell.execute') {
          flashAttempts++;
          if (flashAttempts === 1) {
            // First attempt fails due to physical cable disconnect
            return {
              success: false,
              error: 'Error: USB device disconnected or hardware not responding'
            };
          }
          // After physical confirmation, second attempt succeeds!
          return { success: true, data: { stdout: 'Firmware flashed successfully' } };
        }
        return { success: true, data: {} };
      })
    };

    let physicalActionPromptReceived = '';
    const mockPhysicalActionHandler = vi.fn().mockImplementation(async (req: { prompt: string; cause: string }) => {
      physicalActionPromptReceived = req.prompt;
      // User plugs in hardware and types "done" or presses Enter!
      return true;
    });

    const result = await engine.executePlan('flash firmware', plan, {
      cwd: '/workspace',
      os: 'mac',
      toolExecutor: mockToolExecutor,
      onPhysicalActionRequired: mockPhysicalActionHandler
    });

    expect(result.success).toBe(true);
    expect(mockPhysicalActionHandler).toHaveBeenCalledOnce();
    expect(physicalActionPromptReceived).toContain('[Physical Action Required]');
    expect(physicalActionPromptReceived).toContain('type "done" or press Enter');

    // Executed flash tool twice (first failed with disconnect, second succeeded after confirmation)
    expect(flashAttempts).toBe(2);
    expect(plan.phases[0].status).toBe('completed');
  });
});

