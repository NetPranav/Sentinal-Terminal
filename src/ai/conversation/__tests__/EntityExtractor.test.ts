/**
 * EntityExtractor.test.ts — Tests for regex-based entity extraction
 */

import { describe, it, expect } from 'vitest';
import { EntityExtractor } from '../EntityExtractor';

describe('EntityExtractor', () => {
  const extractor = new EntityExtractor();

  // ── Ports ──────────────────────────────────────────────────────────────

  describe('port extraction', () => {
    it('should extract port from "port 3000"', () => {
      const entities = extractor.extract('Kill the process on port 3000');
      const ports = entities.filter(e => e.type === 'port');
      expect(ports.length).toBe(1);
      expect(ports[0].value).toBe('3000');
      expect(ports[0].confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('should extract port from "localhost:8080"', () => {
      const entities = extractor.extract('Open localhost:8080');
      const ports = entities.filter(e => e.type === 'port');
      expect(ports.length).toBe(1);
      expect(ports[0].value).toBe('8080');
    });

    it('should extract multiple ports', () => {
      const entities = extractor.extract('Check port 3000 and port 8080');
      const ports = entities.filter(e => e.type === 'port');
      expect(ports.length).toBe(2);
    });

    it('should reject invalid ports', () => {
      const entities = extractor.extract('port 99999');
      const ports = entities.filter(e => e.type === 'port');
      expect(ports.length).toBe(0);
    });
  });

  // ── IP Addresses ───────────────────────────────────────────────────────

  describe('IP address extraction', () => {
    it('should extract IPv4 addresses', () => {
      const entities = extractor.extract('Ping 192.168.1.1');
      const ips = entities.filter(e => e.type === 'ip_address');
      expect(ips.length).toBe(1);
      expect(ips[0].value).toBe('192.168.1.1');
    });
  });

  // ── Emails ─────────────────────────────────────────────────────────────

  describe('email extraction', () => {
    it('should extract email addresses', () => {
      const entities = extractor.extract('Send to user@example.com');
      const emails = entities.filter(e => e.type === 'email');
      expect(emails.length).toBe(1);
      expect(emails[0].value).toBe('user@example.com');
    });
  });

  // ── URLs ───────────────────────────────────────────────────────────────

  describe('URL extraction', () => {
    it('should extract https URLs', () => {
      const entities = extractor.extract('Open https://github.com/user/repo');
      const urls = entities.filter(e => e.type === 'url');
      expect(urls.length).toBeGreaterThanOrEqual(1);
      expect(urls[0].value).toContain('github.com');
    });

    it('should extract www URLs and add https://', () => {
      const entities = extractor.extract('Visit www.example.com');
      const urls = entities.filter(e => e.type === 'url');
      expect(urls.length).toBe(1);
      expect(urls[0].value).toBe('https://www.example.com');
    });
  });

  // ── Paths & Files ─────────────────────────────────────────────────────

  describe('path extraction', () => {
    it('should extract tilde paths', () => {
      const entities = extractor.extract('Open ~/Documents/report.pdf');
      const paths = entities.filter(e => e.type === 'path');
      expect(paths.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract files with extensions', () => {
      const entities = extractor.extract('Edit config.json');
      const files = entities.filter(e => e.type === 'file');
      expect(files.length).toBe(1);
      expect(files[0].value).toBe('config.json');
    });

    it('should recognize well-known folder names', () => {
      const entities = extractor.extract('Go to Downloads folder');
      const folders = entities.filter(e => e.type === 'folder');
      expect(folders.length).toBeGreaterThanOrEqual(1);
      expect(folders.some(f => f.value === '~/Downloads')).toBe(true);
    });

    it('should recognize Desktop', () => {
      const entities = extractor.extract('Save to Desktop');
      const folders = entities.filter(e => e.type === 'folder');
      expect(folders.some(f => f.value === '~/Desktop')).toBe(true);
    });
  });

  // ── Applications ───────────────────────────────────────────────────────

  describe('application extraction', () => {
    it('should extract known applications', () => {
      const entities = extractor.extract('Open Chrome');
      const apps = entities.filter(e => e.type === 'application');
      expect(apps.length).toBeGreaterThanOrEqual(1);
      expect(apps[0].value).toBe('Chrome');
    });

    it('should extract multiple apps', () => {
      const entities = extractor.extract('Close Chrome and open Spotify');
      const apps = entities.filter(e => e.type === 'application');
      expect(apps.length).toBe(2);
    });

    it('should extract unknown capitalized app names', () => {
      const entities = extractor.extract('Open Raycast');
      const apps = entities.filter(e => e.type === 'application');
      expect(apps.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Bluetooth Devices ─────────────────────────────────────────────────

  describe('bluetooth device extraction', () => {
    it('should extract known bluetooth devices', () => {
      const entities = extractor.extract('Connect to AirPods');
      const devices = entities.filter(e => e.type === 'bluetooth_device');
      expect(devices.length).toBeGreaterThanOrEqual(1);
      expect(devices[0].value).toBe('AirPods');
    });

    it('should extract quoted device names', () => {
      const entities = extractor.extract('Connect to "My Speaker"');
      const devices = entities.filter(e => e.type === 'bluetooth_device');
      expect(devices.length).toBe(1);
      expect(devices[0].value).toBe('My Speaker');
    });
  });

  // ── Repositories ───────────────────────────────────────────────────────

  describe('repository extraction', () => {
    it('should extract GitHub URLs', () => {
      const entities = extractor.extract('Clone https://github.com/user/repo');
      const repos = entities.filter(e => e.type === 'repository');
      expect(repos.length).toBe(1);
      expect(repos[0].value).toBe('user/repo');
    });
  });

  // ── Branches ───────────────────────────────────────────────────────────

  describe('branch extraction', () => {
    it('should extract branch names', () => {
      const entities = extractor.extract('Checkout branch feature/login');
      const branches = entities.filter(e => e.type === 'branch');
      expect(branches.length).toBe(1);
      expect(branches[0].value).toBe('feature/login');
    });
  });

  // ── Containers ─────────────────────────────────────────────────────────

  describe('container extraction', () => {
    it('should extract container names from docker commands', () => {
      const entities = extractor.extract('Docker stop my-nginx');
      const containers = entities.filter(e => e.type === 'container');
      expect(containers.length).toBe(1);
      expect(containers[0].value).toBe('my-nginx');
    });
  });

  // ── Packages ───────────────────────────────────────────────────────────

  describe('package extraction', () => {
    it('should extract npm packages', () => {
      const entities = extractor.extract('npm install express');
      const packages = entities.filter(e => e.type === 'package');
      expect(packages.length).toBe(1);
      expect(packages[0].value).toBe('express');
    });

    it('should extract generic install targets', () => {
      const entities = extractor.extract('Install lodash');
      const packages = entities.filter(e => e.type === 'package');
      expect(packages.length).toBe(1);
      expect(packages[0].value).toBe('lodash');
    });
  });

  // ── SSH Hosts ──────────────────────────────────────────────────────────

  describe('SSH host extraction', () => {
    it('should extract SSH hosts', () => {
      const entities = extractor.extract('SSH into prod-server');
      const hosts = entities.filter(e => e.type === 'ssh_host');
      expect(hosts.length).toBe(1);
      expect(hosts[0].value).toBe('prod-server');
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      expect(extractor.extract('')).toEqual([]);
    });

    it('should return empty array for whitespace', () => {
      expect(extractor.extract('   ')).toEqual([]);
    });

    it('should handle multi-entity requests', () => {
      const entities = extractor.extract(
        'Open Chrome and go to https://github.com on port 3000'
      );
      expect(entities.length).toBeGreaterThanOrEqual(2);
      const types = entities.map(e => e.type);
      expect(types).toContain('application');
      expect(types).toContain('url');
    });

    it('should deduplicate entities by type and value', () => {
      const entities = extractor.extract('Open Chrome with Chrome');
      const chromes = entities.filter(e => e.type === 'application' && e.value === 'Chrome');
      expect(chromes.length).toBe(1);
    });
  });
});
