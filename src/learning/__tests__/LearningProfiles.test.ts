import { describe, it, expect, beforeEach } from 'vitest';
import { LearningProfiles } from '../policies/LearningProfiles';

describe('LearningProfiles — Context and Privacy Management', () => {
  let profiles: LearningProfiles;

  beforeEach(() => {
    profiles = new LearningProfiles();
  });

  it('should start with a default personal profile active', () => {
    const active = profiles.getActiveProfile();
    expect(active.id).toBe('default');
    expect(active.type).toBe('personal');
    expect(active.isActive).toBe(true);
  });

  it('should allow creating and switching to new profiles', () => {
    profiles.createProfile('work1', 'Corporate', 'work');
    profiles.setActiveProfile('work1');

    const active = profiles.getActiveProfile();
    expect(active.id).toBe('work1');
    expect(active.type).toBe('work');
  });

  it('should throw error when switching to nonexistent profile', () => {
    expect(() => profiles.setActiveProfile('missing')).toThrowError('Profile not found');
  });
});
