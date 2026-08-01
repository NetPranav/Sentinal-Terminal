/**
 * WorkflowDesigner.ts — Visual editor scaffolding
 */

export interface DesignerNode {
  readonly id: string;
  readonly type: 'Action' | 'Condition' | 'Loop';
  position: { x: number, y: number };
}

export class WorkflowDesigner {
  private nodes: DesignerNode[] = [];

  public addNode(type: DesignerNode['type'], x: number, y: number): DesignerNode {
    const node: DesignerNode = {
      id: `node_${Date.now()}`,
      type,
      position: { x, y }
    };
    this.nodes.push(node);
    return node;
  }

  public serializeToEngine(): string {
    // Converts UI graph bounds to raw Workflow Engine JSON
    return JSON.stringify({ version: '1.0', nodes: this.nodes });
  }
}
