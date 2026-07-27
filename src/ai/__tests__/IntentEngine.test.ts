import { describe, it, expect } from 'vitest';
import { IntentEngine } from '../intent/IntentEngine';
import { ModelManager } from '../management/ModelManager';
import { ToolLoader } from '../../tools/loader/ToolLoader';

describe('Phase X — Core Intent Engine & Multi-Step Planner Verification', () => {
  const loader = new ToolLoader();
  loader.loadAll();
  const registry = loader.getState();
  const modelManager = new ModelManager();
  const engine = new IntentEngine(registry, modelManager);

  it('should convert single instruction into structured JSON execution plan without shell commands', async () => {
    const res = await engine.parseIntent('show me all the bluetooth devices');

    expect(res.plan.tasks).toHaveLength(1);
    expect(res.plan.tasks[0].tool).toBe('network.bluetooth.list');
    expect(res.plan.confidence).toBeGreaterThanOrEqual(0.90);
    expect(res.validation.valid).toBe(true);
  });

  it('should decompose compound multi-step instructions into sequential execution tasks', async () => {
    // Example from PHASE X requirement: "Turn on bluetooth and connect my headphones."
    const res = await engine.parseIntent('Turn on bluetooth and connect my headphones.');

    expect(res.plan.tasks.length).toBeGreaterThanOrEqual(2);
    expect(res.plan.tasks[0].tool).toBe('network.bluetooth.on');
    expect(res.plan.tasks[1].tool).toBe('network.bluetooth.connect');
    expect(res.plan.tasks[1].entities.device).toBe('headphones');
    expect(res.plan.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('should sequence applications and browser actions cleanly', async () => {
    // Example from PHASE X requirement: Open Chrome. Go to YouTube. Search for AI.
    const res = await engine.parseIntent('Open Chrome. Go to YouTube. Search for AI.');

    expect(res.plan.tasks).toHaveLength(3);
    expect(res.plan.tasks[0].tool).toBe('application.open');
    expect(res.plan.tasks[0].entities.app).toBe('Chrome');
    expect(res.plan.tasks[1].tool).toBe('browser.navigate');
    expect(res.plan.tasks[2].tool).toBe('browser.search');
    expect(res.plan.tasks[2].entities.query).toBe('AI');
    expect(res.validation.valid).toBe(true);

    const openInRes = await engine.parseIntent('open youtube.com in safari');
    expect(openInRes.plan.tasks[0].tool).toBe('application.open');
    expect(openInRes.plan.tasks[0].entities.app).toBe('safari');
    expect(openInRes.plan.tasks[0].entities.url).toBe('youtube.com');
  });

  it('should auto-correct aliased or shorthand tools to canonical registry IDs', async () => {
    const res = await engine.parseIntent('turn my bluetooth on');
    expect(res.plan.tasks[0].tool).toBe('network.bluetooth.on');
  });

  it('should record telemetry for low confidence or ambiguous queries', async () => {
    const res = await engine.parseIntent('do something');
    expect(res.plan.confidence).toBeLessThan(0.50);

    const telemetryRecords = engine.telemetry.getRecords('FAILED_MATCH');
    expect(telemetryRecords.length).toBeGreaterThan(0);
  });

  it('should route natural language folder inspection queries to filesystem tools with normalized path entities', async () => {
    const res1 = await engine.parseIntent('show the content of Downlods');
    expect(res1.plan.tasks[0].tool).toBe('filesystem.list');
    expect(res1.plan.tasks[0].entities.path || res1.plan.tasks[0].entities.directory).toBe('~/Downloads');

    const res2 = await engine.parseIntent('Hey there go to Donwloads Folder');
    expect(res2.plan.tasks[0].tool).toBe('filesystem.list');
    expect(res2.plan.tasks[0].entities.path || res2.plan.tasks[0].entities.directory).toBe('~/Downloads');
  });

  it('should accurately differentiate between wifi and bluetooth power controls', async () => {
    const resOff = await engine.parseIntent('turn the wifi off');
    expect(resOff.plan.tasks[0].tool).toBe('network.wifi.off');

    const resOn = await engine.parseIntent('turn my wifi on');
    expect(resOn.plan.tasks[0].tool).toBe('network.wifi.on');
  });

  it('should route conversational connection requests to Wi-Fi connection tool with clean SSID extraction', async () => {
    const res1 = await engine.parseIntent('connect me to nothing phone 3a pro');
    expect(res1.plan.tasks[0].tool).toBe('network.wifi.connect');
    expect(res1.plan.tasks[0].entities.ssid).toBe('nothing phone 3a pro');

    const res2 = await engine.parseIntent('connect it to nothing phone 3a');
    expect(res2.plan.tasks[0].tool).toBe('network.wifi.connect');
    expect(res2.plan.tasks[0].entities.ssid).toBe('nothing phone 3a');
  });

  it('should cleanly parse folder creation and deletion intents with full path synthesis', async () => {
    const res1 = await engine.parseIntent('Hey in Downloads folder Make a new folder named AAAAAAAA');
    expect(res1.plan.tasks[0].tool).toBe('filesystem.mkdir');
    expect(res1.plan.tasks[0].entities.path).toBe('~/Downloads/AAAAAAAA');

    const res2 = await engine.parseIntent('delete folder AAAAAAAA in Downloads');
    expect(res2.plan.tasks[0].tool).toBe('filesystem.delete');
    expect(res2.plan.tasks[0].entities.path).toBe('~/Downloads/AAAAAAAA');
  });

  it('should accurately route common daily tasks directly to native capabilities without requiring manual user correction', async () => {
    const killRes = await engine.parseIntent('kill process node');
    expect(killRes.plan.tasks[0].tool).toBe('system.kill_process');
    expect(killRes.plan.tasks[0].entities.process).toBe('node');

    const killAntigravityRes = await engine.parseIntent('kill antigravity');
    expect(killAntigravityRes.plan.tasks[0].tool).toBe('system.kill_process');
    expect(killAntigravityRes.plan.tasks[0].entities.process).toBe('antigravity');

    const stopChromeRes = await engine.parseIntent('entirely stop all the process of chrome');
    expect(stopChromeRes.plan.tasks[0].tool).toBe('system.kill_process');
    expect(stopChromeRes.plan.tasks[0].entities.process).toBe('chrome');

    const readRes = await engine.parseIntent('read file config.json');
    expect(readRes.plan.tasks[0].tool).toBe('filesystem.read');
    expect(readRes.plan.tasks[0].entities.file).toBe('config.json');

    const procRes = await engine.parseIntent('show running processes');
    expect(procRes.plan.tasks[0].tool).toBe('system.processes');

    const battRes = await engine.parseIntent('check battery status');
    expect(battRes.plan.tasks[0].tool).toBe('system.battery');
  });

  it('should intelligently route location questions and search queries to filesystem.search instead of mkdir', async () => {
    const res = await engine.parseIntent('tell me the path where did you create AAAAAA folder');
    expect(res.plan.tasks[0].tool).toBe('filesystem.search');
    expect(res.plan.tasks[0].entities.pattern).toBe('AAAAAA');
    expect(res.plan.tasks[0].entities.dir).toBe('~');
  });

  it('should reliably route queries about currently running processes and network ports (active/free)', async () => {
    const procRes = await engine.parseIntent('hey tell me all the process that is curreently running');
    expect(procRes.plan.tasks[0].tool).toBe('system.processes');

    const portRes1 = await engine.parseIntent('hey tell me which port is currently free and which are active');
    expect(portRes1.plan.tasks[0].tool).toBe('network.ports');

    const portRes2 = await engine.parseIntent('is port 3000 is free');
    expect(portRes2.plan.tasks[0].tool).toBe('network.ports');
    expect(portRes2.plan.tasks[0].entities.port).toBe(3000);
  });

  it('should accurately route desktop running app queries and expanded developer/system commands', async () => {
    const appsRes = await engine.parseIntent('tell me all the running applications');
    expect(appsRes.plan.tasks[0].tool).toBe('application.list_running');

    const dockerRes = await engine.parseIntent('list docker containers');
    expect(dockerRes.plan.tasks[0].tool).toBe('docker.ps');

    const cursorRes = await engine.parseIntent('open in cursor');
    expect(cursorRes.plan.tasks[0].tool).toBe('developer.cursor');

    const gitRes = await engine.parseIntent('show git commit history');
    expect(gitRes.plan.tasks[0].tool).toBe('git.log');

    const calRes = await engine.parseIntent('show me the calendar for this month');
    expect(calRes.plan.tasks[0].tool).toBe('shell.execute');
    expect(calRes.plan.tasks[0].entities.command).toBe('cal');

    const whoRes = await engine.parseIntent('who am i');
    expect(whoRes.plan.tasks[0].tool).toBe('shell.execute');
    expect(whoRes.plan.tasks[0].entities.command).toBe('whoami');

    const clearRes = await engine.parseIntent('clear terminal');
    expect(clearRes.plan.tasks[0].tool).toBe('shell.execute');
    expect(clearRes.plan.tasks[0].entities.command).toBe('clear');

    const envRes = await engine.parseIntent('show enviornment variables');
    expect(envRes.plan.tasks[0].tool).toBe('shell.execute');
    expect(envRes.plan.tasks[0].entities.command).toBe('env');

    const timeRes = await engine.parseIntent('what time is it');
    expect(timeRes.plan.tasks[0].tool).toBe('shell.execute');
    expect(timeRes.plan.tasks[0].entities.command).toBe('date');
  });
});
