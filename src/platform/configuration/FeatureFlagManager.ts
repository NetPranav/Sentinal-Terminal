/**
 * FeatureFlagManager.ts — Dynamic runtime flags without recompilation
 */

export type FeatureFlagChannel = 'Stable' | 'Beta' | 'Experimental' | 'Developer' | 'Hidden';

export class FeatureFlagManager {
  private flags: Map<string, boolean> = new Map();
  private channel: FeatureFlagChannel;

  constructor(channel: FeatureFlagChannel = 'Stable') {
    this.channel = channel;
  }

  public setChannel(channel: FeatureFlagChannel): void {
    this.channel = channel;
  }

  public getChannel(): FeatureFlagChannel {
    return this.channel;
  }

  public enableFlag(flag: string): void {
    this.flags.set(flag, true);
  }

  public disableFlag(flag: string): void {
    this.flags.set(flag, false);
  }

  public isEnabled(flag: string): boolean {
    return this.flags.get(flag) ?? false;
  }
}

export const globalFeatureFlagManager = new FeatureFlagManager();
