import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyResolver, DependencyError } from '../dependencies/DependencyResolver';
import { PluginManifest } from '../models/PluginTypes';

const baseManifest = {
  name: 'T', version: '1.0.0', author: 'A', description: 'D', 
  license: 'MIT', sdkVersion: '1.0.0', entrypoint: 'index.js',
  executionModel: 'workflow' as const, permissions: []
};

describe('DependencyResolver — DAG Sorting', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  it('should correctly order a valid DAG', () => {
    const m1: PluginManifest = { ...baseManifest, id: 'p1', dependencies: { 'p2': '1.0.0' } };
    const m2: PluginManifest = { ...baseManifest, id: 'p2', dependencies: { 'p3': '1.0.0' } };
    const m3: PluginManifest = { ...baseManifest, id: 'p3' };

    const ordered = resolver.resolveOrder([m1, m2, m3]);
    expect(ordered.length).toBe(3);
    // p3 has no dependencies, should be first
    expect(ordered[0].id).toBe('p3');
    // p2 depends on p3
    expect(ordered[1].id).toBe('p2');
    // p1 depends on p2
    expect(ordered[2].id).toBe('p1');
  });

  it('should throw on missing dependency', () => {
    const m1: PluginManifest = { ...baseManifest, id: 'p1', dependencies: { 'p-missing': '1.0.0' } };
    expect(() => resolver.resolveOrder([m1])).toThrowError(DependencyError);
  });

  it('should throw on circular dependency', () => {
    const m1: PluginManifest = { ...baseManifest, id: 'p1', dependencies: { 'p2': '1.0.0' } };
    const m2: PluginManifest = { ...baseManifest, id: 'p2', dependencies: { 'p1': '1.0.0' } };
    
    expect(() => resolver.resolveOrder([m1, m2])).toThrowError(/Circular dependency/);
  });
});
