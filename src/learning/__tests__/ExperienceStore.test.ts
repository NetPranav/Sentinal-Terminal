import { describe, it, expect, beforeEach } from 'vitest';
import { ExperienceStore } from '../store/ExperienceStore';
import { ExperienceRecord } from '../models/LearningTypes';

describe('ExperienceStore — Independent Time-Series Store', () => {
  let store: ExperienceStore;

  beforeEach(() => {
    store = new ExperienceStore();
  });

  it('should append new experience records', () => {
    const record: ExperienceRecord = {
      id: 'exp1', category: 'workflow_executed', entityId: 'w1', timestamp: 100,
      context: { sessionId: 's1' }
    };
    store.append(record);
    expect(store.getCount()).toBe(1);
  });

  it('should query experiences by category and time filters', () => {
    store.append({ id: '1', category: 'application_opened', entityId: 'vscode', timestamp: 100, context: { sessionId: 's1' } });
    store.append({ id: '2', category: 'repair_performed', entityId: 'r1', timestamp: 200, context: { sessionId: 's1' } });
    store.append({ id: '3', category: 'application_opened', entityId: 'chrome', timestamp: 300, context: { sessionId: 's1' } });

    const apps = store.query({ category: 'application_opened' });
    expect(apps.length).toBe(2);

    const recent = store.query({ sinceTimestamp: 250 });
    expect(recent.length).toBe(1);
    expect(recent[0].id).toBe('3');

    const specificApp = store.query({ entityId: 'vscode' });
    expect(specificApp.length).toBe(1);
  });

  it('should clear all experiences', () => {
    store.append({ id: '1', category: 'application_opened', entityId: 'vscode', timestamp: 100, context: { sessionId: 's1' } });
    expect(store.getCount()).toBe(1);
    store.clear();
    expect(store.getCount()).toBe(0);
  });
});
