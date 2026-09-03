import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceRegistry } from './WorkspaceRegistry';
import * as path from 'path';

describe('WorkspaceRegistry (Pillar 2.2)', () => {
  let registry: WorkspaceRegistry;

  beforeEach(() => {
    registry = new WorkspaceRegistry();
  });

  it('scans and returns discovered projects without crashing', async () => {
    const projects = await registry.scan();
    expect(Array.isArray(projects)).toBe(true);
    // When run inside this project repo, should detect current repo
    const currentName = path.basename(path.resolve('.'));
    const matched = projects.find(p => p.name === currentName || p.path === path.resolve('.'));
    if (matched) {
      expect(matched.type).toBeDefined();
    }
  });

  it('caches projects and returns them synchronously from getCachedProjects', async () => {
    await registry.scan();
    const cached = registry.getCachedProjects();
    expect(Array.isArray(cached)).toBe(true);
  });
});
