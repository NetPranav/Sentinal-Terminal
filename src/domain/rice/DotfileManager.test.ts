import { describe, it, expect } from 'vitest';
import { DotfileManager, FileSystemIO } from './DotfileManager';

describe('DotfileManager — Safe Rice & Startup Configuration Editor', () => {
  const initialHyprlandConf = `
# Hyprland Config
monitor=,preferred,auto,1

# Autostart
exec-once = waybar
exec-once = gazebo &
exec-once = nm-applet
`;

  it('safely disables an autostart application by commenting it out in hyprland.conf', async () => {
    let writtenFile = '';
    let backupCreated = '';

    const mockIO: FileSystemIO = {
      exists: async () => true,
      readFile: async () => initialHyprlandConf,
      writeFile: async (p, content) => {
        if (p.includes('.bak_')) backupCreated = p;
        else writtenFile = content;
      },
      copyFile: async () => {}
    };

    const result = await DotfileManager.toggleAutostart('gazebo', false, 'hyprland', mockIO, '/home/user');

    expect(result.success).toBe(true);
    expect(result.actionTaken).toContain('Commented out autostart for "gazebo"');
    expect(writtenFile).toContain('# exec-once = gazebo & # Disabled by Sentinel');
    expect(result.diff).toContain('- exec-once = gazebo &');
    expect(result.diff).toContain('+ # exec-once = gazebo & # Disabled by Sentinel');
    expect(backupCreated).toContain('hyprland.conf.bak_');
  });

  it('safely re-enables an autostart application by uncommenting in hyprland.conf', async () => {
    const commentedConf = `
# Autostart
exec-once = waybar
# exec-once = gazebo & # Disabled by Sentinel
`;

    let writtenFile = '';
    const mockIO: FileSystemIO = {
      exists: async () => true,
      readFile: async () => commentedConf,
      writeFile: async (p, content) => {
        if (!p.includes('.bak_')) writtenFile = content;
      },
      copyFile: async () => {}
    };

    const result = await DotfileManager.toggleAutostart('gazebo', true, 'hyprland', mockIO, '/home/user');

    expect(result.success).toBe(true);
    expect(result.actionTaken).toContain('Uncommented autostart for "gazebo"');
    expect(writtenFile).toContain('exec-once = gazebo &');
    expect(writtenFile).not.toContain('Disabled by Sentinel');
  });

  it('appends a new autostart directive if target is not currently present in config', async () => {
    const minimalConf = `
monitor=,preferred,auto,1
`;

    let writtenFile = '';
    const mockIO: FileSystemIO = {
      exists: async () => true,
      readFile: async () => minimalConf,
      writeFile: async (p, content) => {
        if (!p.includes('.bak_')) writtenFile = content;
      },
      copyFile: async () => {}
    };

    const result = await DotfileManager.toggleAutostart('dunst', true, 'hyprland', mockIO, '/home/user');

    expect(result.success).toBe(true);
    expect(result.actionTaken).toContain('Added new autostart directive');
    expect(writtenFile).toContain('exec-once = dunst');
  });

  it('supports i3 window manager config autostart syntax', async () => {
    const i3Conf = `
# i3 config
exec --no-startup-id picom -b
exec --no-startup-id gazebo
`;

    let writtenFile = '';
    const mockIO: FileSystemIO = {
      exists: async () => true,
      readFile: async () => i3Conf,
      writeFile: async (p, content) => {
        if (!p.includes('.bak_')) writtenFile = content;
      },
      copyFile: async () => {}
    };

    const result = await DotfileManager.toggleAutostart('gazebo', false, 'i3', mockIO, '/home/user');

    expect(result.success).toBe(true);
    expect(writtenFile).toContain('# exec --no-startup-id gazebo # Disabled by Sentinel');
  });
});
