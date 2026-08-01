import { describe, it, expect } from 'vitest';
import { AutoUpdater } from '../updater/AutoUpdater';
import { MigrationManager, SchemaMigration } from '../migration/MigrationManager';
import { InstallerEngine } from '../installer/InstallerEngine';

describe('Production Platform — Updates, Migration & Installer', () => {
  it('AutoUpdater should respect release channels', async () => {
    const updater = new AutoUpdater();
    updater.setChannel('Nightly');
    
    let info = await updater.checkForUpdates();
    expect(info).toBeNull(); // Mock returns null for Nightly

    updater.setChannel('Stable');
    info = await updater.checkForUpdates();
    expect(info?.version).toBe('3.0.1');
  });

  it('MigrationManager should chain schema upgrades safely', () => {
    const mgr = new MigrationManager();
    mgr.registerMigration({
      fromVersion: 1, toVersion: 2, migrate: (d) => ({ ...d, added: true })
    });
    mgr.registerMigration({
      fromVersion: 2, toVersion: 3, migrate: (d) => ({ ...d, v3: true })
    });

    const result = mgr.migrate({ base: 1 }, 1, 3);
    expect(result.added).toBe(true);
    expect(result.v3).toBe(true);
  });

  it('InstallerEngine should expose lifecycle scaffolding', async () => {
    const engine = new InstallerEngine();
    await expect(engine.executePhase('FirstLaunch')).resolves.not.toThrow();
  });
});
