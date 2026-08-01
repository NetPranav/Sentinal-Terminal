import { describe, it, expect } from 'vitest';
import { WorkflowBuilder } from '../builder/WorkflowBuilder';

describe('WorkflowBuilder — Fluent API, CRUD Lifecycle & Nested Workflow Support', () => {
  it('should construct a complete UserWorkflow via fluent builder API with typed variables, actions, and outputs', () => {
    const wf = new WorkflowBuilder('Deploy Project', 'pranav')
      .setDescription('Automated deployment workflow')
      .setCategory('devops')
      .addTag('deploy')
      .addVariable('projectPath', 'path', 'Project directory', true)
      .addVariable('branch', 'string', 'Git branch', false, 'main')
      .addVariable('port', 'port', 'Server port', false, 3000)
      .addAction('checkout', 'Checkout', 'git.checkout', { path: '{{projectPath}}', branch: '{{branch}}' })
      .addAction('deploy', 'Deploy', 'server.deploy', { path: '{{projectPath}}', port: '{{port}}' }, ['checkout'])
      .addOutput('deployUrl', 'string', 'Deployed URL', 'deploy', 'url')
      .addTrigger('manual')
      .build();

    expect(wf.id).toContain('wf-');
    expect(wf.metadata.author).toBe('pranav');
    expect(wf.metadata.category).toBe('devops');
    expect(wf.variables.length).toBe(3);
    expect(wf.nodes.length).toBe(2);
    expect(wf.outputs.length).toBe(1);
    expect(wf.outputs[0].name).toBe('deployUrl');
    expect(wf.triggers.length).toBe(1);
    expect(wf.enabled).toBe(true);
    expect(wf.executionCount).toBe(0);
  });

  it('should support nested workflow invocation nodes referencing other workflows by ID', () => {
    const wf = new WorkflowBuilder('Morning Development')
      .addAction('wifi', 'Connect WiFi', 'network.wifi.connect', { ssid: 'Home_5G' })
      .addNestedWorkflow('docker-stack', 'Start Docker', 'tpl-docker-stack', { composePath: 'dockerPath' }, ['wifi'])
      .addAction('ide', 'Open IDE', 'application.launch', { application: 'Cursor' }, ['docker-stack'])
      .build();

    expect(wf.nodes.length).toBe(3);
    const nested = wf.nodes.find(n => n.type === 'nested_workflow');
    expect(nested).toBeDefined();
    expect(nested?.nestedWorkflowId).toBe('tpl-docker-stack');
    expect(nested?.dependencies).toContain('wifi');
  });

  it('should duplicate and clone workflows producing independent copies with fresh IDs', () => {
    const original = new WorkflowBuilder('Original')
      .addAction('step1', 'Step 1', 'system.noop')
      .build();

    const duplicated = WorkflowBuilder.duplicate(original, 'Copy');
    expect(duplicated.id).not.toBe(original.id);
    expect(duplicated.executionCount).toBe(0);

    const cloned = WorkflowBuilder.clone(original);
    expect(cloned.id).toBe(original.id); // Clone preserves ID
    expect(cloned.nodes.length).toBe(original.nodes.length);
  });

  it('should construct workflows with parallel, conditional, loop, and wait control flow nodes', () => {
    const wf = new WorkflowBuilder('Control Flow Demo')
      .addAction('a1', 'Action A', 'system.noop')
      .addAction('a2', 'Action B', 'system.noop')
      .addParallel('par', 'Parallel Block', ['a1', 'a2'])
      .addConditional('cond', 'Check Flag', { variable: 'deploy', operator: '==', value: true }, ['a1'], ['a2'], ['par'])
      .addLoop('loop', 'Iterate Files', ['a1'], { loopCount: 5 })
      .addWait('wait', 'Pause', 2000)
      .build();

    expect(wf.nodes.length).toBe(6);
    expect(wf.nodes.find(n => n.type === 'parallel')).toBeDefined();
    expect(wf.nodes.find(n => n.type === 'conditional')).toBeDefined();
    expect(wf.nodes.find(n => n.type === 'loop')).toBeDefined();
    expect(wf.nodes.find(n => n.type === 'wait')).toBeDefined();
  });
});
