import { describe, expect, it, vi } from 'vitest';
import { isExplicitFilesystemSearch, findFastPath, AgentLoop } from './AgentLoop';
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
});
