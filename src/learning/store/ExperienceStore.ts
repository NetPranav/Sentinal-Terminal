/**
 * ExperienceStore.ts — Independent Append-Only Experience Store
 *
 * Stores experience records optimized for time-series analytics and pattern discovery.
 * Strictly decoupled from MemoryStore (facts vs behavior).
 */

import { ExperienceRecord, LearningProfile } from '../models/LearningTypes';

export class ExperienceStore {
  private experiences: ExperienceRecord[] = [];
  private activeProfileId: string = 'default';

  /**
   * Append a new experience to the store.
   */
  public append(record: ExperienceRecord): void {
    // In a real implementation this would write to an append-only local SQLite/JSON stream.
    // For now we store in memory array, associating it implicitly or explicitly with active profile.
    this.experiences.push(record);
  }

  /**
   * Retrieve all experiences, optionally filtered by category or time range.
   */
  public query(options?: { 
    category?: string; 
    entityId?: string; 
    sinceTimestamp?: number;
    profileId?: string;
  }): ExperienceRecord[] {
    let results = this.experiences;

    if (options) {
      if (options.category) {
        results = results.filter(e => e.category === options.category);
      }
      if (options.entityId) {
        results = results.filter(e => e.entityId === options.entityId);
      }
      if (options.sinceTimestamp) {
        results = results.filter(e => e.timestamp >= options.sinceTimestamp!);
      }
      // Note: In an advanced implementation, records would store their profile ID.
      // For this isolated store demo, we assume the store partitions natively.
    }

    return results;
  }

  /**
   * Clears the store. Used for privacy reset requirements.
   */
  public clear(): void {
    this.experiences = [];
  }

  public getCount(): number {
    return this.experiences.length;
  }
}

export const globalExperienceStore = new ExperienceStore();
