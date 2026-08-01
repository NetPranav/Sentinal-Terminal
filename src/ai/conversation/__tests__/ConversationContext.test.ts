/**
 * ConversationContext.test.ts — Tests for pronoun resolution and reference tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationContext } from '../ConversationContext';
import type { ConversationGoal, ConversationEntity, NormalizedGoal } from '../ConversationTypes';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeGoal(id: string, domain: string, action: string): ConversationGoal {
  return { id: id as NormalizedGoal, domain: domain as ConversationGoal['domain'], action, raw: `test: ${id}` };
}

function makeEntity(type: string, value: string, confidence: number = 0.95): ConversationEntity {
  return { type: type as ConversationEntity['type'], value, confidence, raw: value };
}

describe('ConversationContext', () => {
  let ctx: ConversationContext;

  beforeEach(() => {
    ctx = new ConversationContext();
  });

  describe('addTurn', () => {
    it('should store goals and entities', () => {
      ctx.addTurn(
        makeGoal('application.open', 'application', 'open'),
        [makeEntity('application', 'Chrome')]
      );

      expect(ctx.getRecentGoals().length).toBe(1);
      expect(ctx.getRecentGoals()[0].id).toBe('application.open');
      expect(ctx.getRecentEntitiesByType('application' as ConversationEntity['type']).length).toBe(1);
    });

    it('should set active subject to highest-confidence entity', () => {
      ctx.addTurn(
        makeGoal('application.open', 'application', 'open'),
        [
          makeEntity('application', 'Chrome', 0.97),
          makeEntity('url', 'https://google.com', 0.90),
        ]
      );

      expect(ctx.getActiveSubject()?.value).toBe('Chrome');
    });

    it('should respect max entities per type', () => {
      for (let i = 0; i < 10; i++) {
        ctx.addTurn(
          makeGoal('application.open', 'application', 'open'),
          [makeEntity('application', `App${i}`)]
        );
      }
      // Should keep only last 5
      expect(ctx.getRecentEntitiesByType('application' as ConversationEntity['type']).length).toBe(5);
    });
  });

  describe('pronoun resolution', () => {
    it('should resolve "it" to the active subject', () => {
      ctx.addTurn(
        makeGoal('application.open', 'application', 'open'),
        [makeEntity('application', 'Chrome')]
      );

      const refs = ctx.resolveReferences('Now close it');
      expect(refs.length).toBe(1);
      expect(refs[0].resolved.value).toBe('Chrome');
    });

    it('should resolve "that" to the active subject', () => {
      ctx.addTurn(
        makeGoal('filesystem.create_folder', 'filesystem', 'create_folder'),
        [makeEntity('folder', 'MyProject')]
      );

      const refs = ctx.resolveReferences('Delete that');
      expect(refs.length).toBe(1);
      expect(refs[0].resolved.value).toBe('MyProject');
    });

    it('should resolve "the app" to recent application entity', () => {
      ctx.addTurn(
        makeGoal('application.open', 'application', 'open'),
        [makeEntity('application', 'Spotify')]
      );

      const refs = ctx.resolveReferences('Quit the app');
      expect(refs.length).toBe(1);
      expect(refs[0].resolved.value).toBe('Spotify');
    });

    it('should resolve "the file" to recent file entity', () => {
      ctx.addTurn(
        makeGoal('filesystem.create_file', 'filesystem', 'create_file'),
        [makeEntity('file', 'report.pdf')]
      );

      const refs = ctx.resolveReferences('Open the file');
      expect(refs.length).toBe(1);
      expect(refs[0].resolved.value).toBe('report.pdf');
    });

    it('should return empty when no context exists', () => {
      const refs = ctx.resolveReferences('Close it');
      expect(refs.length).toBe(0);
    });
  });

  describe('applyResolutions', () => {
    it('should replace pronouns with resolved values', () => {
      ctx.addTurn(
        makeGoal('application.open', 'application', 'open'),
        [makeEntity('application', 'Chrome')]
      );

      const refs = ctx.resolveReferences('Now close it');
      const resolved = ctx.applyResolutions('Now close it', refs);
      expect(resolved).toBe('Now close Chrome');
    });
  });

  describe('containsReferences', () => {
    it('should detect "it"', () => {
      expect(ctx.containsReferences('Close it')).toBe(true);
    });

    it('should detect "the app"', () => {
      expect(ctx.containsReferences('Kill the app')).toBe(true);
    });

    it('should not flag normal input', () => {
      expect(ctx.containsReferences('Open Chrome')).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return immutable snapshot', () => {
      ctx.addTurn(
        makeGoal('application.open', 'application', 'open'),
        [makeEntity('application', 'Chrome')]
      );

      const state = ctx.getState();
      expect(state.turnCount).toBe(1);
      expect(state.activeSubject?.value).toBe('Chrome');
      expect(state.recentGoals.length).toBe(1);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      ctx.addTurn(
        makeGoal('application.open', 'application', 'open'),
        [makeEntity('application', 'Chrome')]
      );

      ctx.reset();

      expect(ctx.hasContext()).toBe(false);
      expect(ctx.getActiveSubject()).toBeNull();
      expect(ctx.getRecentGoals().length).toBe(0);
    });
  });
});
