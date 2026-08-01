/**
 * AutoUpdater.ts — Version and channel checking
 */

export type ReleaseChannel = 'Stable' | 'Beta' | 'Nightly';

export interface UpdateInfo {
  readonly version: string;
  readonly downloadUrl: string;
  readonly releaseNotes: string;
}

export class AutoUpdater {
  private currentVersion: string = '3.0.0';
  private channel: ReleaseChannel = 'Stable';

  public setChannel(channel: ReleaseChannel): void {
    this.channel = channel;
  }

  public async checkForUpdates(): Promise<UpdateInfo | null> {
    // In production, this would make an HTTPS request to an update server
    // For now, we mock a response simulating no update if on Nightly,
    // and an available update if on Stable
    
    if (this.channel === 'Stable') {
      return {
        version: '3.0.1',
        downloadUrl: 'https://updates.sentinel.com/v3.0.1.zip',
        releaseNotes: 'Security patches and bug fixes.'
      };
    }
    
    return null; // Already up to date
  }
}
