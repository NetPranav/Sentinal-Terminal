/**
 * WorkflowScheduler.ts — Multi-Trigger Workflow Scheduling Engine
 *
 * Supports 8 trigger modes: manual, on_login, on_startup, daily, weekly, cron,
 * filesystem_event, and application_event.
 */

import { UserWorkflow, WorkflowTrigger, TriggerType } from '../models/WorkflowTypes';

export interface ScheduledWorkflow {
  readonly workflowId: string;
  readonly trigger: WorkflowTrigger;
  readonly nextFireAt?: number;
  readonly lastFiredAt?: number;
  readonly fireCount: number;
  readonly active: boolean;
}

export class WorkflowScheduler {
  private scheduled: Map<string, ScheduledWorkflow> = new Map();

  /**
   * Register a workflow's triggers with the scheduler.
   */
  public schedule(workflow: UserWorkflow): ScheduledWorkflow[] {
    const results: ScheduledWorkflow[] = [];

    for (const trigger of workflow.triggers) {
      if (!trigger.enabled) continue;

      const key = `${workflow.id}:${trigger.type}`;
      const nextFire = this.computeNextFire(trigger);

      const entry: ScheduledWorkflow = {
        workflowId: workflow.id,
        trigger,
        nextFireAt: nextFire,
        fireCount: 0,
        active: true,
      };

      this.scheduled.set(key, entry);
      results.push(entry);
    }

    return results;
  }

  /**
   * Unschedule all triggers for a workflow.
   */
  public unschedule(workflowId: string): number {
    let removed = 0;
    for (const [key] of this.scheduled) {
      if (key.startsWith(`${workflowId}:`)) {
        this.scheduled.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Get all workflows that should fire at the given timestamp.
   */
  public getReadyWorkflows(currentTime: number = Date.now()): ScheduledWorkflow[] {
    const ready: ScheduledWorkflow[] = [];

    for (const [key, entry] of this.scheduled) {
      if (!entry.active) continue;

      if (entry.trigger.type === 'manual') continue;

      if (entry.nextFireAt && currentTime >= entry.nextFireAt) {
        ready.push(entry);

        // Update next fire time
        const nextFire = this.computeNextFire(entry.trigger, currentTime);
        this.scheduled.set(key, {
          ...entry,
          lastFiredAt: currentTime,
          nextFireAt: nextFire,
          fireCount: entry.fireCount + 1,
        });
      }
    }

    return ready;
  }

  /**
   * Check if a specific trigger type should fire (for event-driven triggers).
   */
  public evaluateEventTrigger(
    eventType: 'login' | 'startup' | 'filesystem_change' | 'app_launch',
    eventPayload?: Record<string, unknown>
  ): ScheduledWorkflow[] {
    const triggerMap: Record<string, TriggerType> = {
      login: 'on_login',
      startup: 'on_startup',
      filesystem_change: 'filesystem_event',
      app_launch: 'application_event',
    };

    const targetType = triggerMap[eventType];
    if (!targetType) return [];

    const matched: ScheduledWorkflow[] = [];

    for (const [, entry] of this.scheduled) {
      if (!entry.active || entry.trigger.type !== targetType) continue;

      // For filesystem events, verify the watched path matches
      if (targetType === 'filesystem_event' && entry.trigger.watchPath) {
        const changedPath = eventPayload?.path as string;
        if (changedPath && !changedPath.startsWith(entry.trigger.watchPath)) continue;
      }

      // For application events, verify the bundle ID matches
      if (targetType === 'application_event' && entry.trigger.applicationId) {
        const appId = eventPayload?.applicationId as string;
        if (appId && appId !== entry.trigger.applicationId) continue;
      }

      matched.push(entry);
    }

    return matched;
  }

  /**
   * Get all currently scheduled entries.
   */
  public getAll(): ScheduledWorkflow[] {
    return Array.from(this.scheduled.values());
  }

  private computeNextFire(trigger: WorkflowTrigger, fromTime: number = Date.now()): number | undefined {
    const hour = 1000 * 60 * 60;
    const day = hour * 24;

    switch (trigger.type) {
      case 'daily': {
        const [h, m] = (trigger.timeOfDay || '09:00').split(':').map(Number);
        const next = new Date(fromTime);
        next.setHours(h, m, 0, 0);
        if (next.getTime() <= fromTime) next.setTime(next.getTime() + day);
        return next.getTime();
      }
      case 'weekly': {
        const targetDay = trigger.dayOfWeek ?? 1; // Monday default
        const next = new Date(fromTime);
        const currentDay = next.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        next.setTime(next.getTime() + daysUntil * day);
        next.setHours(9, 0, 0, 0);
        return next.getTime();
      }
      case 'cron':
        // Simplified: fire every hour for cron expressions
        return fromTime + hour;
      case 'on_login':
      case 'on_startup':
      case 'filesystem_event':
      case 'application_event':
        return undefined; // Event-driven, not time-based
      case 'manual':
      default:
        return undefined;
    }
  }

  public clear(): void {
    this.scheduled.clear();
  }
}

export const globalWorkflowScheduler = new WorkflowScheduler();
