import { describe, it, expect, beforeEach } from 'vitest';
import { ActionSearch } from '../search/ActionSearch';
import { ActionRegistry } from '../registry/ActionRegistry';
import { createMockAction } from './helpers';

describe('ActionSearch', () => {
  let registry: ActionRegistry;
  let search: ActionSearch;

  beforeEach(() => {
    registry = new ActionRegistry();
    search = new ActionSearch(registry);

    registry.register(createMockAction({
      id: 'application.open',
      displayName: 'Open Application',
      category: 'Desktop',
      tags: ['application', 'open', 'launch'],
      aliases: ['open app', 'launch app', 'start application'],
      requiredEntities: ['application'],
    }));
    registry.register(createMockAction({
      id: 'application.close',
      displayName: 'Close Application',
      category: 'Desktop',
      tags: ['application', 'close', 'quit'],
      aliases: ['close app', 'quit app'],
      requiredEntities: ['application'],
    }));
    registry.register(createMockAction({
      id: 'bluetooth.connect',
      displayName: 'Connect Bluetooth Device',
      category: 'Network',
      tags: ['bluetooth', 'connect', 'device'],
      aliases: ['connect device', 'pair device'],
      requiredEntities: ['bluetooth_device'],
      capabilities: [
        { name: 'auto_reconnect', description: 'Auto reconnect on disconnect', enabledByDefault: true },
      ],
    }));
    registry.register(createMockAction({
      id: 'filesystem.copy',
      displayName: 'Copy File',
      category: 'Filesystem',
      tags: ['filesystem', 'copy', 'file'],
      aliases: ['copy file', 'duplicate file'],
    }));
  });

  it('should return exact ID match with score 1.0', () => {
    const results = search.search('application.open');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].action.id).toBe('application.open');
    expect(results[0].score).toBe(1.0);
    expect(results[0].matchType).toBe('exact');
  });

  it('should return alias match with score 0.9', () => {
    const results = search.search('open app');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].action.id).toBe('application.open');
    expect(results[0].score).toBe(0.9);
    expect(results[0].matchType).toBe('alias');
  });

  it('should return entity matches', () => {
    const results = search.search('bluetooth_device');
    const btMatch = results.find(r => r.action.id === 'bluetooth.connect');
    expect(btMatch).toBeDefined();
    expect(btMatch!.matchType).toBe('entity');
  });

  it('should return category matches', () => {
    const results = search.search('desktop');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every(r => r.action.category === 'Desktop')).toBe(true);
  });

  it('should return tag matches', () => {
    const results = search.search('launch');
    const match = results.find(r => r.action.id === 'application.open');
    expect(match).toBeDefined();
  });

  it('should return capability matches', () => {
    const results = search.search('auto_reconnect');
    const match = results.find(r => r.action.id === 'bluetooth.connect');
    expect(match).toBeDefined();
    expect(match!.matchType).toBe('capability');
  });

  it('should return semantic substring matches', () => {
    const results = search.search('copy');
    const match = results.find(r => r.action.id === 'filesystem.copy');
    expect(match).toBeDefined();
  });

  it('should respect the limit parameter', () => {
    const results = search.search('application', 1);
    expect(results).toHaveLength(1);
  });

  it('should sort results by descending score', () => {
    const results = search.search('application');
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('findBestMatch should return the top result', () => {
    const best = search.findBestMatch('application.open');
    expect(best).not.toBeNull();
    expect(best!.action.id).toBe('application.open');
  });

  it('findBestMatch should return null for no match', () => {
    const best = search.findBestMatch('zzz_nonexistent_zzz');
    expect(best).toBeNull();
  });

  it('findCandidates should filter by threshold', () => {
    const candidates = search.findCandidates('application', 0.5);
    expect(candidates.every(c => c.score >= 0.5)).toBe(true);
  });
});
