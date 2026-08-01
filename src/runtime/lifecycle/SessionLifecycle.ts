/**
 * SessionLifecycle.ts — Manages the lifecycle of active execution sessions
 *
 * Ensures clean creation, tracking, and automatic eviction of sessions
 * after completion to guarantee the runtime remains stateless between sessions.
 */

import { ExecutionSession } from '../sessions/ExecutionSession';
import { SessionSnapshot, SessionProgress } from '../models/RuntimeTypes';

export class SessionLifecycleManager {
  private activeSessions: Map<string, ExecutionSession> = new Map();

  public register(session: ExecutionSession): void {
    this.activeSessions.set(session.sessionId, session);
  }

  public unregister(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  public getSession(sessionId: string): ExecutionSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  public getProgress(sessionId: string): SessionProgress | undefined {
    const session = this.activeSessions.get(sessionId);
    return session?.getProgress();
  }

  public async cancelSession(sessionId: string, nodeId?: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    await session.cancel(nodeId);
    return true;
  }

  public pauseSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    session.pause();
    return true;
  }

  public resumeSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    session.resume();
    return true;
  }

  public exportSession(sessionId: string): SessionSnapshot | undefined {
    return this.activeSessions.get(sessionId)?.export();
  }

  public getActiveCount(): number {
    return this.activeSessions.size;
  }

  public clearAll(): void {
    this.activeSessions.clear();
  }
}
