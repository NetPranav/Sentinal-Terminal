import { describe, it, expect } from 'vitest';
import { getPlatform, isLinux, isMacOS, isWindows, getShortcutModifier, formatShortcut } from '../platform';

describe('Cross-Platform Utilities', () => {
  it('should detect host platform correctly', () => {
    const platform = getPlatform();
    expect(['linux', 'macos', 'windows']).toContain(platform);
  });

  it('should return boolean flags consistently', () => {
    const platform = getPlatform();
    if (platform === 'linux') {
      expect(isLinux()).toBe(true);
      expect(isMacOS()).toBe(false);
      expect(isWindows()).toBe(false);
      expect(getShortcutModifier()).toBe('Ctrl');
    } else if (platform === 'macos') {
      expect(isMacOS()).toBe(true);
      expect(getShortcutModifier()).toBe('⌘');
    }
  });

  it('should format keyboard shortcuts appropriately per platform', () => {
    const shortcutT = formatShortcut('t');
    const shortcutDShift = formatShortcut('d', true);

    if (isMacOS()) {
      expect(shortcutT).toBe('⌘T');
      expect(shortcutDShift).toBe('⇧⌘D');
    } else {
      expect(shortcutT).toBe('Ctrl+T');
      expect(shortcutDShift).toBe('Ctrl+Shift+D');
    }
  });
});
