/**
 * ExperienceBuilder.ts — Normalizes diverse system events into ExperienceRecords.
 */

import { ExperienceCategory, ExperienceContext, ExperienceRecord } from '../models/LearningTypes';

export class ExperienceBuilder {
  /**
   * Generates a unique ID for the experience.
   */
  private generateId(): string {
    return 'exp_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  /**
   * Builds an execution-related experience (e.g., workflow ran, app opened).
   */
  public buildExecutionExperience(
    category: ExperienceCategory,
    entityId: string,
    context: ExperienceContext,
    durationMs?: number,
    metadata?: Record<string, unknown>
  ): ExperienceRecord {
    return {
      id: this.generateId(),
      category,
      entityId,
      timestamp: Date.now(),
      durationMs,
      context,
      metadata,
    };
  }

  /**
   * Builds a feedback-related experience.
   */
  public buildFeedbackExperience(
    category: 'feedback_accepted' | 'feedback_rejected' | 'feedback_ignored' | 'feedback_edited',
    entityId: string,
    context: ExperienceContext,
    metadata?: Record<string, unknown>
  ): ExperienceRecord {
    return {
      id: this.generateId(),
      category,
      entityId,
      timestamp: Date.now(),
      context,
      metadata,
    };
  }
}

export const globalExperienceBuilder = new ExperienceBuilder();
