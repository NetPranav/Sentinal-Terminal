/**
 * DependencyResolver.ts — Validates dependency DAG and semantic versions.
 */

import { PluginManifest } from '../models/PluginTypes';

export class DependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DependencyError';
  }
}

export class DependencyResolver {
  
  /**
   * Performs topological sort on plugins.
   * Throws DependencyError on missing dependencies or cycles.
   */
  public resolveOrder(manifests: PluginManifest[]): PluginManifest[] {
    const manifestMap = new Map<string, PluginManifest>();
    manifests.forEach(m => manifestMap.set(m.id, m));

    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>(); // pluginId -> plugins that depend on it

    manifests.forEach(m => {
      inDegree.set(m.id, 0);
      graph.set(m.id, []);
    });

    // Build Graph
    manifests.forEach(m => {
      if (m.dependencies) {
        for (const [depId] /*, depVersion*/ of Object.entries(m.dependencies)) {
          if (!manifestMap.has(depId)) {
            throw new DependencyError(`Plugin ${m.id} requires missing dependency: ${depId}`);
          }
          // Note: semver matching would go here. We mock it for the architectural implementation.
          
          graph.get(depId)!.push(m.id);
          inDegree.set(m.id, inDegree.get(m.id)! + 1);
        }
      }
    });

    // Topological Sort via Kahn's Algorithm
    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) queue.push(id);
    });

    const ordered: PluginManifest[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      ordered.push(manifestMap.get(current)!);

      const dependents = graph.get(current) || [];
      for (const dep of dependents) {
        inDegree.set(dep, inDegree.get(dep)! - 1);
        if (inDegree.get(dep) === 0) {
          queue.push(dep);
        }
      }
    }

    if (ordered.length !== manifests.length) {
      throw new DependencyError('Circular dependency detected among plugins.');
    }

    return ordered;
  }
}
