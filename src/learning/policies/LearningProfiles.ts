/**
 * LearningProfiles.ts — Manages context switching and privacy boundaries
 */

import { LearningProfile, LearningProfileType } from '../models/LearningTypes';

export class LearningProfiles {
  private profiles: Map<string, LearningProfile> = new Map();
  private activeProfileId: string = 'default';

  constructor() {
    this.createProfile('default', 'Personal', 'personal');
    this.setActiveProfile('default');
  }

  public createProfile(id: string, name: string, type: LearningProfileType): LearningProfile {
    const profile: LearningProfile = {
      id,
      name,
      type,
      isActive: false,
      createdAt: Date.now()
    };
    this.profiles.set(id, profile);
    return profile;
  }

  public setActiveProfile(id: string): void {
    if (!this.profiles.has(id)) throw new Error('Profile not found');
    
    this.profiles.forEach(p => (p as any).isActive = false);
    const p = this.profiles.get(id);
    (p as any).isActive = true;
    this.activeProfileId = id;
  }

  public getActiveProfile(): LearningProfile {
    return this.profiles.get(this.activeProfileId)!;
  }

  public resetProfile(id: string): void {
    // In a real system, this would trigger ExperienceStore to drop all records matching profileId
    // For this mock, we just touch the profile.
    if (!this.profiles.has(id)) throw new Error('Profile not found');
  }
}

export const globalLearningProfiles = new LearningProfiles();
