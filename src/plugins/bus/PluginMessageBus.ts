/**
 * PluginMessageBus.ts — Strongly-typed inter-plugin isolated communication channel.
 */

export interface PluginMessage {
  readonly id: string;
  readonly senderId: string;
  readonly targetId: string;
  readonly topic: string;
  readonly payload: any;
  readonly timestamp: number;
}

export type MessageHandler = (message: PluginMessage) => void;

export class PluginMessageBus {
  private subscribers: Map<string, Set<MessageHandler>> = new Map(); // targetId -> handlers

  public subscribe(pluginId: string, handler: MessageHandler): void {
    if (!this.subscribers.has(pluginId)) {
      this.subscribers.set(pluginId, new Set());
    }
    this.subscribers.get(pluginId)!.add(handler);
  }

  public unsubscribe(pluginId: string, handler: MessageHandler): void {
    const set = this.subscribers.get(pluginId);
    if (set) {
      set.delete(handler);
    }
  }

  public publish(senderId: string, targetId: string, topic: string, payload: any): void {
    const message: PluginMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      senderId,
      targetId,
      topic,
      payload, // Should ideally be deep cloned to prevent reference leaking
      timestamp: Date.now()
    };

    const set = this.subscribers.get(targetId);
    if (set) {
      // Async dispatch to prevent blocking
      set.forEach(handler => {
        queueMicrotask(() => {
          try {
            handler(message);
          } catch (e) {
            console.error(`PluginMessageBus Error dispatching to ${targetId}:`, e);
          }
        });
      });
    }
  }
}

export const globalPluginMessageBus = new PluginMessageBus();
