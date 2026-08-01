import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext } from '../state/ExecutionContext';

describe('ExecutionContext', () => {
  let ctx: ExecutionContext;

  beforeEach(() => {
    ctx = new ExecutionContext();
  });

  it('should store and retrieve action node outputs', () => {
    ctx.setOutput('node-1', 'path', '/tmp/foo');
    ctx.setOutput('node-1', 'exists', true);

    expect(ctx.getOutput('node-1', 'path')).toBe('/tmp/foo');
    expect(ctx.getOutput('node-1', 'exists')).toBe(true);
    expect(ctx.getOutput('node-2', 'path')).toBeUndefined();
    expect(ctx.getNodeOutputs('node-1')).toEqual({ path: '/tmp/foo', exists: true });
  });

  it('should manage session variables and shared entities', () => {
    ctx.setVariable('retryTimeout', 500);
    ctx.setEntity('application', 'Safari');

    expect(ctx.getVariable('retryTimeout')).toBe(500);
    expect(ctx.getEntity('application')).toBe('Safari');
  });

  it('should serialize to snapshot and restore cleanly into a new instance', () => {
    ctx.setOutput('node-1', 'pid', 1234);
    ctx.setVariable('stage', 'verify');
    ctx.setEntity('port', '8080');

    const snapshot = ctx.export();

    const restored = new ExecutionContext();
    restored.restore(snapshot);

    expect(restored.getOutput('node-1', 'pid')).toBe(1234);
    expect(restored.getVariable('stage')).toBe('verify');
    expect(restored.getEntity('port')).toBe('8080');
  });
});
