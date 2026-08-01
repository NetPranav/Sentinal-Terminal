import { describe, it, expect } from 'vitest';
import { UrlSchemeHandler } from './UrlSchemeHandler';

describe('UrlSchemeHandler', () => {
  const handler = UrlSchemeHandler.getInstance();

  it('parses sentinel://open with encoded file system paths', () => {
    const action = handler.parse('sentinel://open?path=%2FUsers%2Fpranav%2FProjects');
    expect(action.type).toBe('open');
    expect(action.path).toBe('/Users/pranav/Projects');
  });

  it('parses sentinel://workspace URI correctly', () => {
    const action = handler.parse('sentinel://workspace?path=/home/user/code');
    expect(action.type).toBe('workspace');
    expect(action.path).toBe('/home/user/code');
  });

  it('parses sentinel://run with commands and optional working directory', () => {
    const action = handler.parse('sentinel://run?cmd=git%20status&path=%2Fworkspace');
    expect(action.type).toBe('run');
    expect(action.command).toBe('git status');
    expect(action.path).toBe('/workspace');
  });

  it('parses direct POSIX paths from Finder Quick Actions and open -a arguments', () => {
    const action = handler.parse('/Users/pranav/Downloads');
    expect(action.type).toBe('open');
    expect(action.path).toBe('/Users/pranav/Downloads');
  });

  it('parses sentinel://new-tab and sentinel://split commands', () => {
    expect(handler.parse('sentinel://new-tab?path=/root').type).toBe('new-tab');
    expect(handler.parse('sentinel://split').type).toBe('split');
  });

  it('filters out invalid or noop inputs when parsing many', () => {
    const actions = handler.parseMany(['--debug', 'sentinel://open?path=/dir', 'unsupported:protocol']);
    expect(actions.length).toBe(1);
    expect(actions[0].path).toBe('/dir');
  });
});
