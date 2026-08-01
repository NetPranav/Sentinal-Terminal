import { describe, it, expect } from 'vitest';
import { WorkflowDesigner } from '../designer/WorkflowDesigner';
import { ThemeEngine } from '../themes/ThemeEngine';
import { AccessibilityEngine } from '../accessibility/AccessibilityEngine';

describe('UX — Product Polish', () => {
  it('WorkflowDesigner should serialize node scaffolding safely', () => {
    const designer = new WorkflowDesigner();
    designer.addNode('Action', 100, 200);
    
    const json = designer.serializeToEngine();
    expect(json).toContain('"type":"Action"');
    expect(json).toContain('"x":100');
  });

  it('ThemeEngine should toggle between verified sets', () => {
    const themes = new ThemeEngine();
    themes.setTheme('Glass');
    expect(themes.getTheme()).toBe('Glass');
    expect(themes.getAvailableThemes()).toContain('Matrix');
  });

  it('AccessibilityEngine should respect overrides', () => {
    const a11y = new AccessibilityEngine();
    a11y.update({ highContrast: true });
    
    expect(a11y.getPreferences().highContrast).toBe(true);
    expect(a11y.getPreferences().reducedMotion).toBe(false);
  });
});
