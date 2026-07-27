export type PermissionCategory = 
  | 'ReadFiles' 
  | 'WriteFiles' 
  | 'DeleteFiles' 
  | 'RenameFiles' 
  | 'ShellExecution' 
  | 'Network' 
  | 'Clipboard' 
  | 'Git' 
  | 'Docker' 
  | 'SSH' 
  | 'EnvironmentVariables' 
  | 'SystemSettings' 
  | 'Administrator'
  | 'ProcessManagement';

export type PermissionState = 'AlwaysAllow' | 'AskEveryTime' | 'AlwaysDeny';

export type PermissionProfile = 'Developer' | 'Administrator' | 'ReadOnly' | 'Guest' | 'SafeMode' | 'Custom';

export interface IPermissionManager {
  checkPermission(category: PermissionCategory): PermissionState;
  setPermission(category: PermissionCategory, state: PermissionState): void;
  setProfile(profile: PermissionProfile): void;
  getCurrentProfile(): PermissionProfile;
}

export class PermissionManager implements IPermissionManager {
  private static instance?: PermissionManager;
  private permissions: Map<PermissionCategory, PermissionState> = new Map();
  private currentProfile: PermissionProfile = 'SafeMode';
  private skipSave = false;

  static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
      PermissionManager.instance.loadState();
    }
    return PermissionManager.instance;
  }

  constructor() {
    this.skipSave = true;
    this.setProfile('SafeMode'); // Default
    this.skipSave = false;
  }

  private loadState(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('sentinel_permission_state');
        if (saved) {
          const data = JSON.parse(saved);
          if (data.profile) {
            this.currentProfile = data.profile;
          }
          if (data.permissions) {
            Object.entries(data.permissions).forEach(([key, val]) => {
              this.permissions.set(key as PermissionCategory, val as PermissionState);
            });
          }
        }
      } catch (e) {
        console.warn('[PermissionManager] Failed to load persisted state:', e);
      }
    }
  }

  private saveState(): void {
    if (this.skipSave) return;
    if (typeof localStorage !== 'undefined') {
      try {
        const permsObj: Record<string, string> = {};
        this.permissions.forEach((val, key) => { permsObj[key] = val; });
        localStorage.setItem('sentinel_permission_state', JSON.stringify({
          profile: this.currentProfile,
          permissions: permsObj
        }));
      } catch (e) {
        console.warn('[PermissionManager] Failed to save state:', e);
      }
    }
  }

  checkPermission(category: PermissionCategory): PermissionState {
    return this.permissions.get(category) || 'AskEveryTime';
  }

  setPermission(category: PermissionCategory, state: PermissionState): void {
    this.permissions.set(category, state);
    this.currentProfile = 'Custom';
    this.saveState();
  }

  getCurrentProfile(): PermissionProfile {
    return this.currentProfile;
  }

  setProfile(profile: PermissionProfile): void {
    this.currentProfile = profile;
    this.permissions.clear();

    switch (profile) {
      case 'Developer':
        this.permissions.set('ReadFiles', 'AlwaysAllow');
        this.permissions.set('WriteFiles', 'AlwaysAllow');
        this.permissions.set('DeleteFiles', 'AskEveryTime'); // Even devs should be asked before delete
        this.permissions.set('RenameFiles', 'AlwaysAllow');
        this.permissions.set('ShellExecution', 'AlwaysAllow');
        this.permissions.set('Network', 'AlwaysAllow');
        this.permissions.set('Clipboard', 'AlwaysAllow');
        this.permissions.set('ProcessManagement', 'AlwaysAllow');
        break;
      case 'Administrator':
        // Extremely permissive
        Object.values(['ReadFiles', 'WriteFiles', 'DeleteFiles', 'RenameFiles', 'ShellExecution', 'Network', 'Clipboard', 'ProcessManagement'] as PermissionCategory[])
          .forEach(cat => this.permissions.set(cat, 'AlwaysAllow'));
        this.permissions.set('Administrator', 'AlwaysAllow');
        break;
      case 'ReadOnly':
        this.permissions.set('ReadFiles', 'AlwaysAllow');
        this.permissions.set('Network', 'AlwaysAllow');
        this.permissions.set('Clipboard', 'AlwaysAllow');
        // Everything else defaults to AskEveryTime or could be explicitly denied
        this.permissions.set('WriteFiles', 'AlwaysDeny');
        this.permissions.set('DeleteFiles', 'AlwaysDeny');
        this.permissions.set('ShellExecution', 'AlwaysDeny');
        break;
      case 'SafeMode':
        this.permissions.set('ReadFiles', 'AlwaysAllow');
        this.permissions.set('Network', 'AskEveryTime');
        this.permissions.set('WriteFiles', 'AskEveryTime');
        this.permissions.set('DeleteFiles', 'AlwaysDeny'); // Default deny deletes in safe mode
        this.permissions.set('ShellExecution', 'AskEveryTime');
        this.permissions.set('ProcessManagement', 'AskEveryTime');
        break;
      case 'Guest':
        this.permissions.set('ReadFiles', 'AskEveryTime');
        this.permissions.set('WriteFiles', 'AlwaysDeny');
        this.permissions.set('DeleteFiles', 'AlwaysDeny');
        this.permissions.set('ShellExecution', 'AlwaysDeny');
        break;
    }
    this.saveState();
  }
}
