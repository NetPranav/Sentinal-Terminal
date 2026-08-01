/**
 * AccessibilityEngine.ts — UI accessibility enforcement
 */

export interface A11yPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  fontScale: number;
}

export class AccessibilityEngine {
  private prefs: A11yPreferences = {
    reducedMotion: false,
    highContrast: false,
    fontScale: 1.0
  };

  public update(newPrefs: Partial<A11yPreferences>): void {
    this.prefs = { ...this.prefs, ...newPrefs };
  }

  public getPreferences(): Readonly<A11yPreferences> {
    return this.prefs;
  }
}
