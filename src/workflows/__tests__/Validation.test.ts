import { describe, it, expect } from 'vitest';
import { WorkflowValidator } from '../validation/WorkflowValidator';
import { WorkflowBuilder } from '../builder/WorkflowBuilder';

describe('WorkflowValidator — Structural, Semantic & Circular Reference Validation', () => {
  const validator = new WorkflowValidator();

  it('should validate a well-formed workflow as valid with zero errors', () => {
    const wf = new WorkflowBuilder('Valid Workflow')
      .addVariable('path', 'path', 'Project path', true)
      .addAction('step1', 'Step 1', 'git.checkout', { path: '{{path}}' })
      .addAction('step2', 'Step 2', 'git.push', {}, ['step1'])
      .addOutput('result', 'string', 'Push result', 'step2', 'output')
      .build();

    const result = validator.validate(wf);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should detect circular dependency cycles and report the violating path', () => {
    const wf = new WorkflowBuilder('Circular Workflow')
      .addAction('a', 'A', 'system.noop', {}, ['c'])
      .addAction('b', 'B', 'system.noop', {}, ['a'])
      .addAction('c', 'C', 'system.noop', {}, ['b'])
      .build();

    const result = validator.validate(wf);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Circular dependency'))).toBe(true);
  });

  it('should detect missing action IDs, dangling dependency references, and self-referential nested workflows', () => {
    const wf = new WorkflowBuilder('Invalid Workflow')
      .build();

    // Override nodes manually to inject invalid structures
    const badWf = {
      ...wf,
      nodes: [
        { id: 'n1', type: 'action' as const, name: 'No Action', dependencies: ['nonexistent'] },
        { id: 'n1', type: 'action' as const, name: 'Duplicate', dependencies: [], actionId: 'ok' },
        { id: 'n3', type: 'nested_workflow' as const, name: 'Self Ref', dependencies: [], nestedWorkflowId: wf.id },
      ],
    };

    const result = validator.validate(badWf as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Duplicate node ID'))).toBe(true);
    expect(result.errors.some(e => e.includes('non-existent node'))).toBe(true);
    expect(result.errors.some(e => e.includes('missing an actionId'))).toBe(true);
    expect(result.errors.some(e => e.includes('self-referential'))).toBe(true);
  });

  it('should validate loop nodes require body and iteration specification', () => {
    const wf = new WorkflowBuilder('Loop Issues')
      .addLoop('loop1', 'Bad Loop', [], {})
      .build();

    const result = validator.validate(wf);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('no body nodes'))).toBe(true);
    expect(result.errors.some(e => e.includes('loopCount or loopOverVariable'))).toBe(true);
  });
});
