/**
 * MigrationManager.ts — Schema version migrations
 */

export interface SchemaMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(data: any): any;
}

export class MigrationManager {
  private migrations: SchemaMigration[] = [];

  public registerMigration(migration: SchemaMigration): void {
    this.migrations.push(migration);
    // Ensure sorted order
    this.migrations.sort((a, b) => a.fromVersion - b.fromVersion);
  }

  public migrate(data: any, currentVersion: number, targetVersion: number): any {
    let result = { ...data };
    
    for (const migration of this.migrations) {
      if (migration.fromVersion >= currentVersion && migration.toVersion <= targetVersion) {
        try {
          result = migration.migrate(result);
          currentVersion = migration.toVersion;
        } catch (e) {
          throw new Error(`Migration failed from ${migration.fromVersion} to ${migration.toVersion}`);
        }
      }
    }

    return result;
  }
}
