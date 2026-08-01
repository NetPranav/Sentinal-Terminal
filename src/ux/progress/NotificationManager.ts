/**
 * NotificationManager.ts — Unified UI notifications
 */

export interface AppNotification {
  readonly id: string;
  readonly type: 'success' | 'warning' | 'error' | 'info';
  readonly message: string;
  readonly timestamp: number;
}

export class NotificationManager {
  private notifications: AppNotification[] = [];

  public notify(type: AppNotification['type'], message: string): void {
    this.notifications.push({
      id: `notif_${Date.now()}`,
      type,
      message,
      timestamp: Date.now()
    });
  }

  public getActive(): ReadonlyArray<AppNotification> {
    return this.notifications;
  }
}
