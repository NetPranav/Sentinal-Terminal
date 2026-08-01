/**
 * ConversationMemory.test.ts — Tests for ring buffer conversation memory
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationMemory } from '../ConversationMemory';
import type { ConversationGoal, ConversationEntity, NormalizedGoal } from '../ConversationTypes';

function makeGoal(id: string): ConversationGoal {
  const [domain, action] = id.split('.');
  return { id: id as NormalizedGoal, domain: domain as ConversationGoal['domain'], action, raw: `test: ${id}` };
}

function makeEntity(type: string, value: string): ConversationEntity {
  return { type: type as ConversationEntity['type'], value, confidence: 0.95, raw: value };
}

describe('ConversationMemory', () => {
  let memory: ConversationMemory;

  beforeEach(() => {
    memory = new ConversationMemory(5);
  });

  describe('addTurn', () => {
    it('should store entries', () => {
      memory.addTurn('Open Chrome', makeGoal('application.open'), [makeEntity('application', 'Chrome')]);
      expect(memory.size()).toBe(1);
      expect(memory.isEmpty()).toBe(false);
    });

    it('should evict oldest when over capacity', () => {
      for (let i = 0; i < 7; i++) {
        memory.addTurn(`Query ${i}`, makeGoal('application.open'), []);
      }
      expect(memory.size()).toBe(5);
    });

    it('should evict in FIFO order', () => {
      for (let i = 0; i < 7; i++) {
        memory.addTurn(`Query ${i}`, makeGoal('application.open'), []);
      }
      const history = memory.getHistory();
      // Newest first
      expect(history[0].query).toBe('Query 6');
      expect(history[4].query).toBe('Query 2');
    });
  });

  describe('getHistory', () => {
    it('should return entries newest first', () => {
      memory.addTurn('First', makeGoal('application.open'), []);
      memory.addTurn('Second', makeGoal('bluetooth.enable'), []);
      memory.addTurn('Third', makeGoal('git.clone'), []);

      const history = memory.getHistory();
      expect(history[0].query).toBe('Third');
      expect(history[2].query).toBe('First');
    });

    it('should limit by n', () => {
      memory.addTurn('First', makeGoal('application.open'), []);
      memory.addTurn('Second', makeGoal('bluetooth.enable'), []);
      memory.addTurn('Third', makeGoal('git.clone'), []);

      const history = memory.getHistory(2);
      expect(history.length).toBe(2);
      expect(history[0].query).toBe('Third');
    });
  });

  describe('getRecentGoals', () => {
    it('should return recent goals newest first', () => {
      memory.addTurn('Open Chrome', makeGoal('application.open'), []);
      memory.addTurn('Turn on BT', makeGoal('bluetooth.enable'), []);

      const goals = memory.getRecentGoals(2);
      expect(goals.length).toBe(2);
      expect(goals[0].id).toBe('bluetooth.enable');
      expect(goals[1].id).toBe('application.open');
    });
  });

  describe('getRecentEntities', () => {
    it('should return deduplicated entities', () => {
      memory.addTurn('Open Chrome', makeGoal('application.open'), [makeEntity('application', 'Chrome')]);
      memory.addTurn('Close Chrome', makeGoal('application.close'), [makeEntity('application', 'Chrome')]);

      const entities = memory.getRecentEntities();
      const chromes = entities.filter(e => e.value === 'Chrome');
      expect(chromes.length).toBe(1);
    });

    it('should return entities from multiple turns', () => {
      memory.addTurn('Open Chrome', makeGoal('application.open'), [makeEntity('application', 'Chrome')]);
      memory.addTurn('Kill port 3000', makeGoal('process.kill_by_port'), [makeEntity('port', '3000')]);

      const entities = memory.getRecentEntities();
      expect(entities.length).toBe(2);
    });
  });

  describe('getLastEntry', () => {
    it('should return the last entry', () => {
      memory.addTurn('First', makeGoal('application.open'), []);
      memory.addTurn('Second', makeGoal('bluetooth.enable'), []);

      expect(memory.getLastEntry()?.query).toBe('Second');
    });

    it('should return null when empty', () => {
      expect(memory.getLastEntry()).toBeNull();
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      memory.addTurn('Test', makeGoal('application.open'), []);
      memory.clear();

      expect(memory.size()).toBe(0);
      expect(memory.isEmpty()).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should serialize to snapshot', () => {
      memory.addTurn('Open Chrome', makeGoal('application.open'), [makeEntity('application', 'Chrome')]);
      memory.addTurn('Turn on BT', makeGoal('bluetooth.enable'), []);

      const snapshot = memory.toSnapshot();
      expect(snapshot.entries.length).toBe(2);
      expect(snapshot.maxSize).toBe(5);
      expect(snapshot.exportedAt).toBeGreaterThan(0);
    });

    it('should restore from snapshot', () => {
      memory.addTurn('Open Chrome', makeGoal('application.open'), [makeEntity('application', 'Chrome')]);
      const snapshot = memory.toSnapshot();

      const newMemory = new ConversationMemory();
      newMemory.fromSnapshot(snapshot);

      expect(newMemory.size()).toBe(1);
      expect(newMemory.getLastEntry()?.query).toBe('Open Chrome');
      expect(newMemory.getMaxSize()).toBe(5);
    });

    it('should handle round-trip serialization', () => {
      for (let i = 0; i < 3; i++) {
        memory.addTurn(`Query ${i}`, makeGoal('application.open'), [makeEntity('application', `App${i}`)]);
      }

      const snapshot = memory.toSnapshot();
      const json = JSON.stringify(snapshot);
      const parsed = JSON.parse(json);

      const restored = new ConversationMemory();
      restored.fromSnapshot(parsed);

      expect(restored.size()).toBe(3);
      expect(restored.getHistory()[0].query).toBe('Query 2');
    });
  });

  describe('configuration', () => {
    it('should respect custom max size', () => {
      const small = new ConversationMemory(3);
      for (let i = 0; i < 5; i++) {
        small.addTurn(`Q${i}`, makeGoal('application.open'), []);
      }
      expect(small.size()).toBe(3);
      expect(small.getMaxSize()).toBe(3);
    });

    it('should enforce minimum size of 1', () => {
      const tiny = new ConversationMemory(0);
      expect(tiny.getMaxSize()).toBe(1);
    });
  });
});
