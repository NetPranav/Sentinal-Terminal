/**
 * ThemeEngine.ts — Runtime theme switching
 */

export type AppTheme = 'Sentinel Dark' | 'Sentinel Light' | 'Glass' | 'Minimal' | 'OLED' | 'Matrix' | 'Developer';

export class ThemeEngine {
  private currentTheme: AppTheme = 'Sentinel Dark';

  public setTheme(theme: AppTheme): void {
    this.currentTheme = theme;
    // In production, dispatches CSS variable updates to the DOM
  }

  public getTheme(): AppTheme {
    return this.currentTheme;
  }

  public getAvailableThemes(): AppTheme[] {
    return ['Sentinel Dark', 'Sentinel Light', 'Glass', 'Minimal', 'OLED', 'Matrix', 'Developer'];
  }
}
