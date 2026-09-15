import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DiskWorkflowStorage } from './DiskWorkflowStorage';
import { SavedWorkflowDefinition, CURRENT_WORKFLOW_SCHEMA_VERSION } from '../models/WorkflowTypes';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('DiskWorkflowStorage (Schema-Versioned Persistence)', () => {
  let tempDir: string;
  let storage: DiskWorkflowStorage;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-wf-test-'));
    storage = new DiskWorkflowStorage(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('saves and loads a workflow with schemaVersion 1', async () => {
    const wf: SavedWorkflowDefinition = {
      schemaVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      name: 'deploy-staging',
      description: 'Build and deploy staging pipeline',
      steps: [
        {
          id: 'step-1',
          name: 'Build project',
          command: 'npm run build',
          cwd: '/tmp/proj'
        },
        {
          id: 'step-2',
          name: 'Run healthcheck',
          command: 'curl http://localhost:8080/health',
          expectedExitCode: 0,
          validationCriteria: 'status 200'
        }
      ],
      parameters: [
        {
          name: 'PORT',
          type: 'port',
          description: 'Target healthcheck port',
          required: false,
          defaultValue: 8080
        }
      ],
      environmentPrerequisites: {
        requiredBinaries: ['npm', 'curl'],
        requiredPorts: [8080]
      },
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      tags: ['deployment', 'staging']
    };

    const filePath = await storage.saveWorkflow(wf);
    expect(fs.existsSync(filePath)).toBe(true);

    const loaded = await storage.loadWorkflow('deploy-staging');
    expect(loaded).toBeDefined();
    expect(loaded?.schemaVersion).toBe(1);
    expect(loaded?.name).toBe('deploy-staging');
    expect(loaded?.steps).toHaveLength(2);
    expect(loaded?.steps[0].command).toBe('npm run build');
    expect(loaded?.steps[1].command).toBe('curl http://localhost:8080/health');
    expect(loaded?.parameters?.[0].name).toBe('PORT');
    expect(loaded?.environmentPrerequisites?.requiredPorts).toEqual([8080]);
  });

  it('migrates legacy unversioned workflow JSON format into schemaVersion 1', async () => {
    const legacyJson = JSON.stringify({
      name: 'legacy-build',
      steps: ['git pull', 'cargo build --release', 'cargo test']
    });

    const filePath = path.join(tempDir, 'legacy-build.json');
    fs.writeFileSync(filePath, legacyJson, 'utf8');

    const loaded = await storage.loadWorkflow('legacy-build');
    expect(loaded).toBeDefined();
    expect(loaded?.schemaVersion).toBe(1);
    expect(loaded?.name).toBe('legacy-build');
    expect(loaded?.steps).toHaveLength(3);
    expect(loaded?.steps[0].command).toBe('git pull');
    expect(loaded?.steps[1].command).toBe('cargo build --release');
    expect(loaded?.steps[2].command).toBe('cargo test');
    expect(loaded?.tags).toContain('migrated');
  });

  it('rejects unsupported future schema versions with descriptive error', async () => {
    const futureJson = JSON.stringify({
      schemaVersion: 99,
      name: 'future-workflow',
      steps: []
    });

    const filePath = path.join(tempDir, 'future-workflow.json');
    fs.writeFileSync(filePath, futureJson, 'utf8');

    await expect(storage.loadWorkflow('future-workflow')).rejects.toThrow(
      /Unsupported workflow schema version 99/
    );
  });

  it('lists and deletes saved workflows correctly', async () => {
    await storage.saveWorkflow({
      schemaVersion: 1,
      name: 'wf-one',
      steps: [{ id: 's1', name: 'S1', command: 'echo 1' }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await storage.saveWorkflow({
      schemaVersion: 1,
      name: 'wf-two',
      steps: [{ id: 's2', name: 'S2', command: 'echo 2' }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    const list = await storage.listWorkflows();
    expect(list.map(w => w.name).sort()).toEqual(['wf-one', 'wf-two']);

    const deleted = await storage.deleteWorkflow('wf-one');
    expect(deleted).toBe(true);

    const remaining = await storage.listWorkflows();
    expect(remaining.map(w => w.name)).toEqual(['wf-two']);
  });
});
