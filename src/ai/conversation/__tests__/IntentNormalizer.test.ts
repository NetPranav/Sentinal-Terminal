/**
 * IntentNormalizer.test.ts — Tests for synonym → canonical goal normalization
 */

import { describe, it, expect } from 'vitest';
import { IntentNormalizer } from '../IntentNormalizer';

describe('IntentNormalizer', () => {
  const normalizer = new IntentNormalizer();

  // ── Bluetooth ──────────────────────────────────────────────────────────

  describe('bluetooth normalization', () => {
    it.each([
      'Turn on Bluetooth',
      'Enable bluetooth',
      'Activate Bluetooth',
      'Switch on bluetooth',
      'Start bluetooth',
      'Power on Bluetooth',
    ])('should normalize "%s" to bluetooth.enable', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('bluetooth.enable');
      expect(result.domain).toBe('bluetooth');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it.each([
      'Turn off Bluetooth',
      'Disable bluetooth',
      'Deactivate Bluetooth',
      'Switch off bluetooth',
      'Stop bluetooth',
    ])('should normalize "%s" to bluetooth.disable', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('bluetooth.disable');
    });

    it.each([
      'Connect to my bluetooth headphones',
      'Pair with bluetooth device',
      'Connect to my AirPods',
      'Pair with my headphones',
    ])('should normalize "%s" to bluetooth.connect', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('bluetooth.connect');
    });

    it.each([
      'Disconnect from my bluetooth headphones',
      'Unpair bluetooth device',
      'Disconnect my AirPods',
    ])('should normalize "%s" to bluetooth.disconnect', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('bluetooth.disconnect');
    });

    it.each([
      'List bluetooth devices',
      'Show all bluetooth devices',
      'Scan bluetooth devices',
      'Find bluetooth devices',
    ])('should normalize "%s" to bluetooth.list', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('bluetooth.list');
    });
  });

  // ── WiFi ───────────────────────────────────────────────────────────────

  describe('wifi normalization', () => {
    it.each([
      'Turn on WiFi',
      'Enable wifi',
      'Enable wi-fi',
      'Activate wireless',
      'Switch on wifi',
    ])('should normalize "%s" to wifi.enable', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('wifi.enable');
    });

    it.each([
      'Turn off wifi',
      'Disable WiFi',
      'Switch off wireless',
    ])('should normalize "%s" to wifi.disable', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('wifi.disable');
    });

    it.each([
      'Scan wifi networks',
      'List all wifi networks',
      'Show available wireless networks',
      'Find wifi',
    ])('should normalize "%s" to wifi.scan', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('wifi.scan');
    });
  });

  // ── Application ────────────────────────────────────────────────────────

  describe('application normalization', () => {
    it.each([
      'Open Chrome',
      'Launch Safari',
      'Start VSCode',
      'Run Spotify',
    ])('should normalize "%s" to application.open', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('application.open');
    });

    it.each([
      'Close Chrome',
      'Quit Safari',
      'Kill VSCode',
      'Terminate Spotify',
      'Force quit Chrome',
    ])('should normalize "%s" to application.close', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('application.close');
    });
  });

  // ── Filesystem ─────────────────────────────────────────────────────────

  describe('filesystem normalization', () => {
    it.each([
      'Create a new folder',
      'Make a folder',
      'Create directory',
      'Make a new directory',
    ])('should normalize "%s" to filesystem.create_folder', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('filesystem.create_folder');
    });

    it.each([
      'Create a file',
      'Make a new file',
      'Touch file',
      'Create a new file',
    ])('should normalize "%s" to filesystem.create_file', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('filesystem.create_file');
    });

    it.each([
      'Find my Downloads folder',
      'Where is the Documents folder',
      'Locate the Desktop folder',
      'Search for my downloads',
    ])('should normalize "%s" to a filesystem locate goal', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toMatch(/^filesystem\.locate/);
    });
  });

  // ── Git ────────────────────────────────────────────────────────────────

  describe('git normalization', () => {
    it.each([
      'git clone',
      'Clone the repo',
      'Download repository',
      'Clone my repository',
    ])('should normalize "%s" to git.clone', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('git.clone');
    });

    it('should normalize "git pull" to git.pull', () => {
      expect(normalizer.normalize('git pull').goal).toBe('git.pull');
    });

    it('should normalize "git push" to git.push', () => {
      expect(normalizer.normalize('git push').goal).toBe('git.push');
    });

    it('should normalize "git commit" to git.commit', () => {
      expect(normalizer.normalize('git commit').goal).toBe('git.commit');
    });

    it('should normalize "git status" to git.status', () => {
      expect(normalizer.normalize('git status').goal).toBe('git.status');
    });
  });

  // ── Process ────────────────────────────────────────────────────────────

  describe('process normalization', () => {
    it.each([
      'Kill the process using port 3000',
      'Stop the process on port 8080',
      'Terminate process listening on port 443',
    ])('should normalize "%s" to process.kill_by_port', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('process.kill_by_port');
    });

    it.each([
      'Free the port',
      'Release the port',
      'Clear the port',
    ])('should normalize "%s" to process.kill_by_port', (input) => {
      const result = normalizer.normalize(input);
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('process.kill_by_port');
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should return no match for empty input', () => {
      const result = normalizer.normalize('');
      expect(result.matched).toBe(false);
      expect(result.goal).toBeNull();
    });

    it('should return no match for gibberish', () => {
      const result = normalizer.normalize('xkjfhw asjdf alskdjf');
      expect(result.matched).toBe(false);
    });

    it('should be case insensitive', () => {
      const result = normalizer.normalize('TURN ON BLUETOOTH');
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('bluetooth.enable');
    });

    it('should handle extra whitespace', () => {
      const result = normalizer.normalize('   turn   on   bluetooth   ');
      expect(result.matched).toBe(true);
      expect(result.goal).toBe('bluetooth.enable');
    });
  });

  // ── Canonical Goals List ───────────────────────────────────────────────

  describe('canonical goals', () => {
    it('should have at least 30 canonical goals', () => {
      const goals = normalizer.getCanonicalGoals();
      expect(goals.length).toBeGreaterThanOrEqual(30);
    });

    it('should only contain domain.action format goals', () => {
      const goals = normalizer.getCanonicalGoals();
      for (const goal of goals) {
        expect(goal).toMatch(/^[a-z]+\.[a-z_]+$/);
      }
    });
  });
});
