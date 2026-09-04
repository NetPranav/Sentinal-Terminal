import { describe, expect, it, vi } from 'vitest';
import { isExplicitFilesystemSearch, findFastPath, AgentLoop, isConversationalRefusal, isActionableGoal } from './AgentLoop';
import { DemonstrationLearningEngine } from '../../domain/learning/DemonstrationLearningEngine';

describe('AgentLoop fast-path routing', () => {
  it('uses the filesystem shortcut only for explicit file-oriented searches', () => {
    expect(isExplicitFilesystemSearch('find all json files in tools')).toBe(true);
    expect(isExplicitFilesystemSearch('locate *.tsx')).toBe(true);
    expect(isExplicitFilesystemSearch('search for a file named config.json')).toBe(true);
  });

  it('leaves ambiguous and web-oriented searches for the local model', () => {
    expect(isExplicitFilesystemSearch('search the web for Rust ownership')).toBe(false);
    expect(isExplicitFilesystemSearch('find me a good coffee shop')).toBe(false);
  });

  it('routes URL opening directly to browser.navigate with target browser application', () => {
    const res = findFastPath('open youtube.com in safari');
    expect(res).not.toBeNull();
    expect(res?.tool).toBe('browser.navigate');
    expect(res?.params.url).toBe('youtube.com');
    expect(res?.params.appName).toBe('safari');

    const res2 = findFastPath('navigate to https://github.com using chrome');
    expect(res2?.tool).toBe('browser.navigate');
    expect(res2?.params.url).toBe('https://github.com');
    expect(res2?.params.appName).toBe('chrome');

    const res3 = findFastPath('open openai.com');
    expect(res3?.tool).toBe('browser.navigate');
    expect(res3?.params.url).toBe('openai.com');
    expect(res3?.params.appName).toBeUndefined();
  });

  it('routes bare URLs, browse commands, and web search shortcuts directly via fast-path', () => {
    // Bare URLs
    const bareUrl1 = findFastPath('github.com');
    expect(bareUrl1?.tool).toBe('browser.navigate');
    expect(bareUrl1?.params.url).toBe('github.com');

    const bareUrl2 = findFastPath('https://news.ycombinator.com');
    expect(bareUrl2?.tool).toBe('browser.navigate');
    expect(bareUrl2?.params.url).toBe('https://news.ycombinator.com');

    // Browse and go to
    const browseRes = findFastPath('browse to docs.rs');
    expect(browseRes?.tool).toBe('browser.navigate');
    expect(browseRes?.params.url).toBe('docs.rs');

    const goToRes = findFastPath('go to https://anthropic.com in Brave');
    expect(goToRes?.tool).toBe('browser.navigate');
    expect(goToRes?.params.url).toBe('https://anthropic.com');
    expect(goToRes?.params.appName).toBe('Brave');

    // Direct Web searches
    const googleRes = findFastPath('google typescript 5.5 features');
    expect(googleRes?.tool).toBe('browser.search');
    expect(googleRes?.params.engine).toBe('google');
    expect(googleRes?.params.query).toBe('typescript 5.5 features');

    const ytRes = findFastPath('youtube lo-fi beats');
    expect(ytRes?.tool).toBe('browser.search');
    expect(ytRes?.params.engine).toBe('youtube');
    expect(ytRes?.params.query).toBe('lo-fi beats');

    const ghRes = findFastPath('search github for tauri plugins');
    expect(ghRes?.tool).toBe('browser.search');
    expect(ghRes?.params.engine).toBe('github');
    expect(ghRes?.params.query).toBe('tauri plugins');

    const webRes = findFastPath('search the web for quantum computing advances');
    expect(webRes?.tool).toBe('browser.search');
    expect(webRes?.params.engine).toBe('google');
    expect(webRes?.params.query).toBe('quantum computing advances');
  });

  it('should resolve workspace disambiguation and execute project plan on user selection', async () => {
    const { AgentLoop } = await import('./AgentLoop');
    const mockToolExecutor = {
      hasDriver: () => true,
      execute: (tool: string, params: any) => Promise.resolve({ success: true, data: { stdout: `Executed ${tool}` } })
    };
    const mockRegistry = {
      toolIndex: { getAll: () => [] }
    };
    const loop = new AgentLoop(mockRegistry as any, mockToolExecutor as any);

    // Simulate pending clarification from a multi-project discovery
    (loop as any).pendingClarification = {
      goal: 'run gazebo',
      plan: {
        summary: 'Disambiguate project for "gazebo"',
        steps: [],
        phases: [],
        question: 'Found 2 projects: [1] drone_ws [2] rover_ws',
        discoveredProjects: [
          {
            id: '1',
            name: 'drone_ws',
            path: '/home/user/drone_ws',
            type: 'ros2',
            setupScript: 'source install/setup.bash',
            launchTarget: 'ros2 launch drone_ws quad.launch.py',
            confidence: 100
          },
          {
            id: '2',
            name: 'rover_ws',
            path: '/home/user/rover_ws',
            type: 'ros1',
            setupScript: 'source devel/setup.bash',
            launchTarget: 'roslaunch rover_ws sim.launch',
            confidence: 90
          }
        ]
      }
    };

    // User chooses option 1
    const result = await loop.run('1', { os: 'linux', cwd: '/home/user' });
    expect(result.success).toBe(true);
    expect(result.cdPath).toBe('/home/user/drone_ws');
    expect(result.steps.length).toBe(3);
    expect(result.steps[0].tool).toBe('filesystem.navigate');
    expect(result.steps[1].tool).toBe('shell.execute');
    expect(result.steps[1].params.command).toBe('source install/setup.bash');
    expect(result.steps[2].tool).toBe('shell.execute');
    expect(result.steps[2].params.command).toBe('ros2 launch drone_ws quad.launch.py');
  });

  it('routes system service and dotfile rice commands directly via fast-path', () => {
    const serviceRes = findFastPath('restart postgresql service');
    expect(serviceRes).not.toBeNull();
    expect(serviceRes?.tool).toBe('system.service');
    expect(serviceRes?.params.service).toBe('postgresql');
    expect(serviceRes?.params.action).toBe('restart');

    const dotfileRes = findFastPath('turn off gazebo in hyprland');
    expect(dotfileRes).not.toBeNull();
    expect(dotfileRes?.tool).toBe('system.dotfile');
    expect(dotfileRes?.params.app).toBe('gazebo');
    expect(dotfileRes?.params.enable).toBe(false);
    expect(dotfileRes?.params.target).toBe('hyprland');
  });

  it('executes user request via learned demonstration pattern without invoking LLM', async () => {
    const learningEngine = DemonstrationLearningEngine.getInstance();
    learningEngine.clear();
    learningEngine.learnExplicit(
      'compress backups into archive',
      'tar -czvf backups.tar.gz ./backups',
      'Compresses backups directory into tar.gz archive'
    );

    const mockToolExecutor = {
      hasDriver: vi.fn().mockReturnValue(true),
      execute: vi.fn().mockResolvedValue({
        success: true,
        data: { stdout: 'backups.tar.gz created' }
      })
    };

    const loop = new AgentLoop(
      { toolIndex: { has: () => false, getAll: () => [] } } as any,
      undefined
    );
    (loop as any).toolExecutor = mockToolExecutor;

    const res = await loop.run('compress backups into archive', { os: 'mac', cwd: '/test' });
    expect(res.success).toBe(true);
    expect(mockToolExecutor.execute).toHaveBeenCalledWith(
      'shell.execute',
      expect.objectContaining({
        command: 'tar -czvf backups.tar.gz ./backups'
      }),
      '/test',
      undefined
    );
    expect(res.summary).toContain('Executed learned workflow: tar -czvf backups.tar.gz ./backups');
  });

  it('normalizes shell-native execute JSON contract into shell.execute tool call', () => {
    const loop = new AgentLoop({ toolIndex: { has: () => false, getAll: () => [] } } as any);
    const parsed = (loop as any).parseLLMResponse(JSON.stringify({
      action: 'execute',
      command: 'mdfind "kMDItemFSName == \'*frontend*\'c && kMDItemContentType == \'public.folder\'"',
      explanation: 'Search entire Mac for frontend directories'
    }));

    expect(parsed).not.toBeNull();
    expect(parsed.action).toBe('tool');
    expect(parsed.tool).toBe('shell.execute');
    expect(parsed.params.command).toBe('mdfind "kMDItemFSName == \'*frontend*\'c && kMDItemContentType == \'public.folder\'"');
    expect(parsed.params.explanation).toBe('Search entire Mac for frontend directories');
  });

  it('normalizes bare command JSON object into shell.execute tool call', () => {
    const loop = new AgentLoop({ toolIndex: { has: () => false, getAll: () => [] } } as any);
    const parsed = (loop as any).parseLLMResponse(JSON.stringify({
      command: 'lsof -iTCP -sTCP:LISTEN -n -P',
      explanation: 'List active listening ports'
    }));

    expect(parsed).not.toBeNull();
    expect(parsed.action).toBe('tool');
    expect(parsed.tool).toBe('shell.execute');
    expect(parsed.params.command).toBe('lsof -iTCP -sTCP:LISTEN -n -P');
  });

  it('routes search query fallback to shell-native Spotlight mdfind on macOS', () => {
    const loop = new AgentLoop({ toolIndex: { has: () => false, getAll: () => [] } } as any);
    const fallback = (loop as any).tryHeuristicFallback('find all frontend folders in my system', { os: 'mac', cwd: '/workspace' });

    expect(fallback).not.toBeNull();
    expect(fallback.tool).toBe('shell.execute');
    expect(fallback.params.command).toContain('mdfind');
    expect(fallback.params.command).toContain('*frontend*');
    expect(fallback.params.command).toContain('public.folder');
  });

  describe('Tier 2: Refusal Interception & Autonomous Self-Healing', () => {
    it('detects canned chatbot refusals accurately', () => {
      expect(isConversationalRefusal("I don't have access to your file system.")).toBe(true);
      expect(isConversationalRefusal("As an AI, I am unable to view your local files or execute commands.")).toBe(true);
      expect(isConversationalRefusal("I cannot access your network or system directories.")).toBe(true);
      expect(isConversationalRefusal("I do not have access to the operating system.")).toBe(true);
      expect(isConversationalRefusal("I am unable to search your computer.")).toBe(true);

      expect(isConversationalRefusal("Found 12 matching folders.")).toBe(false);
      expect(isConversationalRefusal("The active listening port is 3000.")).toBe(false);
      expect(isConversationalRefusal("I am Sentinel, an autonomous mac terminal AI copilot.")).toBe(false);
    });

    it('identifies actionable system goals versus informational queries', () => {
      expect(isActionableGoal('find all frontend folders in my system')).toBe(true);
      expect(isActionableGoal('tell me all available network')).toBe(true);
      expect(isActionableGoal('what is using port 3000')).toBe(true);
      expect(isActionableGoal('kill node process')).toBe(true);
      expect(isActionableGoal('check git status and branches')).toBe(true);

      expect(isActionableGoal('who are you')).toBe(false);
      expect(isActionableGoal('hello')).toBe(false);
      expect(isActionableGoal('what is your name')).toBe(false);
    });

    it('intercepts canned refusal and re-prompts model with terminal execution authority', async () => {
      const mockProvider = {
        name: 'test-provider',
        isAvailable: vi.fn().mockResolvedValue(true),
        generate: vi.fn()
          // Step 1: Model attempts canned refusal
          .mockResolvedValueOnce({
            content: JSON.stringify({
              action: 'done',
              summary: "I don't have access to your file system or computer."
            })
          })
          // Step 2: After refusal interception, model generates the proper command
          .mockResolvedValueOnce({
            content: JSON.stringify({
              action: 'execute',
              command: 'mdfind "kMDItemFSName == \'*frontend*\'c"',
              explanation: 'Search for frontend folders'
            })
          })
          // Step 3: Done
          .mockResolvedValueOnce({
            content: JSON.stringify({
              action: 'done',
              summary: 'Found frontend folders.'
            })
          })
      };

      const mockModelManager = {
        getActiveProvider: () => mockProvider,
        getActiveModel: () => ({ modelId: 'test-model' }),
        initialize: vi.fn().mockResolvedValue(undefined)
      } as any;

      const mockToolExecutor = {
        hasDriver: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { stdout: '/Users/test/frontend\n/Users/test/projects/frontend', code: 0 }
        })
      };

      const loop = new AgentLoop(
        { toolIndex: { has: () => false, getAll: () => [] } } as any,
        mockModelManager
      );
      (loop as any).toolExecutor = mockToolExecutor;

      const events: any[] = [];
      loop.onEvent((ev) => events.push(ev));

      const result = await loop.run('find all frontend folders in my system', { os: 'mac', cwd: '/test' });

      expect(result.success).toBe(true);
      expect(mockProvider.generate).toHaveBeenCalledTimes(3);

      // Verify that refusal interception occurred
      const thinkingEvents = events.filter(e => e.type === 'thinking');
      expect(thinkingEvents.some(e => e.message.includes('Intercepted model refusal'))).toBe(true);

      // Verify command executed
      expect(mockToolExecutor.execute).toHaveBeenCalledWith(
        'shell.execute',
        expect.objectContaining({ command: 'mdfind "kMDItemFSName == \'*frontend*\'c"' }),
        '/test',
        undefined
      );
    });

    it('feeds command stderr and exit code back into AI context for self-healing remediation', async () => {
      const mockProvider = {
        name: 'test-provider',
        isAvailable: vi.fn().mockResolvedValue(true),
        generate: vi.fn()
          // Step 1: Model generates command that fails (e.g. invalid flag)
          .mockResolvedValueOnce({
            content: JSON.stringify({
              action: 'execute',
              command: 'lsof -broken_flag',
              explanation: 'Inspect listening ports'
            })
          })
          // Step 2: In response to failure feedback, model self-heals and generates valid command
          .mockResolvedValueOnce({
            content: JSON.stringify({
              action: 'execute',
              command: 'lsof -iTCP -sTCP:LISTEN -n -P',
              explanation: 'Inspect listening ports with corrected flags'
            })
          })
          // Step 3: Done
          .mockResolvedValueOnce({
            content: JSON.stringify({
              action: 'done',
              summary: 'Listed all listening ports.'
            })
          })
      };

      const mockModelManager = {
        getActiveProvider: () => mockProvider,
        getActiveModel: () => ({ modelId: 'test-model' }),
        initialize: vi.fn().mockResolvedValue(undefined)
      } as any;

      const mockToolExecutor = {
        hasDriver: vi.fn().mockReturnValue(true),
        execute: vi.fn()
          // First attempt fails with non-zero exit code and stderr
          .mockResolvedValueOnce({
            success: false,
            error: 'lsof: illegal option -- broken_flag',
            data: { stderr: 'lsof: illegal option -- broken_flag', code: 1 }
          })
          // Second attempt succeeds
          .mockResolvedValueOnce({
            success: true,
            data: { stdout: 'node 3000 LISTEN\n', code: 0 }
          })
      };

      const loop = new AgentLoop(
        { toolIndex: { has: () => false, getAll: () => [] } } as any,
        mockModelManager
      );
      (loop as any).toolExecutor = mockToolExecutor;

      const events: any[] = [];
      loop.onEvent((ev) => events.push(ev));

      const result = await loop.run('tell me all running ports', { os: 'mac', cwd: '/test' });

      expect(result.success).toBe(true);
      expect(mockToolExecutor.execute).toHaveBeenCalledTimes(2);

      // Verify self-healing thinking event was emitted
      const selfHealingEvent = events.find(e => e.type === 'thinking' && e.message.includes('Self-healing'));
      expect(selfHealingEvent).toBeDefined();

      // Verify the second generate call was given the failure context
      const secondGenerateCall = mockProvider.generate.mock.calls[1][0];
      expect(secondGenerateCall).toContain('COMMAND FAILED:');
      expect(secondGenerateCall).toContain('illegal option');
      expect(secondGenerateCall).toContain('Self-Healing Mode');
    });

    it('activates deterministic safety net fallback when 3 command attempts fail (three strikes)', async () => {
      const mockProvider = {
        name: 'test-provider',
        isAvailable: vi.fn().mockResolvedValue(true),
        generate: vi.fn()
          // 3 broken attempts
          .mockResolvedValueOnce({
            content: JSON.stringify({ action: 'execute', command: 'badcmd1' })
          })
          .mockResolvedValueOnce({
            content: JSON.stringify({ action: 'execute', command: 'badcmd2' })
          })
          .mockResolvedValueOnce({
            content: JSON.stringify({ action: 'execute', command: 'badcmd3' })
          })
      };

      const mockModelManager = {
        getActiveProvider: () => mockProvider,
        getActiveModel: () => ({ modelId: 'test-model' }),
        initialize: vi.fn().mockResolvedValue(undefined)
      } as any;

      const mockToolExecutor = {
        hasDriver: vi.fn().mockReturnValue(true),
        execute: vi.fn()
          .mockResolvedValueOnce({ success: false, error: 'Command badcmd1 not found', data: { code: 127 } })
          .mockResolvedValueOnce({ success: false, error: 'Command badcmd2 not found', data: { code: 127 } })
          .mockResolvedValueOnce({ success: false, error: 'Command badcmd3 not found', data: { code: 127 } })
          // Safety net fallback execution
          .mockResolvedValueOnce({ success: true, data: { stdout: '/Users/test/frontend', code: 0 } })
      };

      const loop = new AgentLoop(
        { toolIndex: { has: () => false, getAll: () => [] } } as any,
        mockModelManager
      );
      (loop as any).toolExecutor = mockToolExecutor;

      const events: any[] = [];
      loop.onEvent((ev) => events.push(ev));

      const result = await loop.run('find all frontend folders in my system', { os: 'mac', cwd: '/test' });

      // Deterministic fallback was triggered after 3 strikes
      expect(mockToolExecutor.execute).toHaveBeenCalledTimes(4);
      expect(result.success).toBe(true);

      const safetyNetEvent = events.find(e => e.type === 'thinking' && e.message.includes('Three command attempts failed'));
      expect(safetyNetEvent).toBeDefined();
    });
  });
});
