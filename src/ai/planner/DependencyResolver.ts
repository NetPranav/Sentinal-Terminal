import { GoalNode } from './PlannerTypes';

/**
 * Pure DAG operations for GoalNodes.
 * Resolves dependencies, detects cycles, and calculates execution tiers.
 */
export class DependencyResolver {
  /**
   * Sorts the nodes topologically and groups them into parallel tiers.
   * Throws an error if a circular dependency is detected.
   */
  public resolve(nodes: GoalNode[]): {
    topologicalOrder: string[];
    parallelGroups: string[][];
  } {
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, GoalNode>();

    // Initialize graphs
    for (const node of nodes) {
      adj.set(node.id, []);
      inDegree.set(node.id, 0);
      nodeMap.set(node.id, node);
    }

    // Populate edges
    for (const node of nodes) {
      for (const dep of node.dependencies) {
        if (!nodeMap.has(dep.nodeId)) {
          throw new Error(`Node ${node.id} depends on non-existent node ${dep.nodeId}`);
        }
        
        // Edge is from dep -> node
        adj.get(dep.nodeId)!.push(node.id);
        inDegree.set(node.id, inDegree.get(node.id)! + 1);
      }
    }

    // Kahn's Algorithm for Topological Sort and Parallel Tiering
    const topologicalOrder: string[] = [];
    const parallelGroups: string[][] = [];
    let queue: string[] = [];

    // Find all nodes with no dependencies
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    while (queue.length > 0) {
      // All nodes in the current queue can run in parallel
      const currentTier = [...queue];
      parallelGroups.push(currentTier);
      
      const nextQueue: string[] = [];

      for (const id of currentTier) {
        topologicalOrder.push(id);
        
        const neighbors = adj.get(id) || [];
        for (const neighbor of neighbors) {
          const currentDegree = inDegree.get(neighbor)! - 1;
          inDegree.set(neighbor, currentDegree);
          
          if (currentDegree === 0) {
            nextQueue.push(neighbor);
          }
        }
      }

      queue = nextQueue;
    }

    // If topological sort doesn't contain all nodes, there is a cycle
    if (topologicalOrder.length !== nodes.length) {
      throw new Error('Circular dependency detected in plan graph.');
    }

    return {
      topologicalOrder,
      parallelGroups
    };
  }
}
