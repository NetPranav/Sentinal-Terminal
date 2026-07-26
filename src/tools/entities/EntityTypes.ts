/**
 * EntityTypes.ts
 * 
 * Defines standard semantic entities supported by the AI Operating Knowledge Base.
 * Designed to scale to thousands of tools while supporting custom future entities.
 */

import { z } from 'zod';

export const CoreEntityTypeSchema = z.enum([
  'file_path',
  'folder',
  'url',
  'repository',
  'git_branch',
  'device_name',
  'ssid',
  'bluetooth_device',
  'application',
  'window',
  'terminal_profile',
  'ip',
  'port',
  'username',
  'email',
  'package',
  'process',
  'container',
  'image',
  'service',
  'shell_command', // Used by shell.execute fallback
]);

export type CoreEntityType = z.infer<typeof CoreEntityTypeSchema>;
export type EntityType = CoreEntityType | string; // Allows future custom entities

export interface ExtractedEntity {
  type: EntityType;
  value: any;
  confidence: number;
  startIndex?: number;
  endIndex?: number;
  source?: string;
}

export class EntityValidator {
  /**
   * Basic regular expressions and heuristics for known core entities.
   */
  public static validate(type: EntityType, value: any): boolean {
    if (value === undefined || value === null) return false;

    if (type === 'port') {
      const num = Number(value);
      return !isNaN(num) && Number.isInteger(num) && num > 0 && num <= 65535;
    }

    const strValue = String(value);

    switch (type) {
      case 'ip':
        return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(strValue) || /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(strValue);
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return /^https?:\/\//i.test(value);
        }
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'file_path':
      case 'folder':
        return value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || value.startsWith('~/') || /^[a-zA-Z]:\\/.test(value);
      default:
        // For SSIDs, device names, containers, custom entities, accept any non-empty value
        return value.trim().length > 0;
    }
  }
}
