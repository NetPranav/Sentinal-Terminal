import { describe, it, expect, vi } from 'vitest';
import { ProgressEngine } from '../progress/ProgressEngine';
import { NotificationManager } from '../progress/NotificationManager';
import { DecisionExplainer } from '../explanations/DecisionExplainer';
import { RecoveryAssistant } from '../recovery/RecoveryAssistant';

describe('UX — Progress & Explanations', () => {
  it('ProgressEngine should notify subscribers on stage transitions', () => {
    const engine = new ProgressEngine();
    const cb = vi.fn();
    engine.subscribe(cb);
    
    engine.setStage('Executing');
    expect(engine.getStage()).toBe('Executing');
    expect(cb).toHaveBeenCalledWith('Executing');
  });

  it('NotificationManager should store alerts securely', () => {
    const mgr = new NotificationManager();
    mgr.notify('warning', 'Low battery');
    expect(mgr.getActive().length).toBe(1);
    expect(mgr.getActive()[0].type).toBe('warning');
  });

  it('DecisionExplainer should map internal intents to friendly strings', () => {
    const explainer = new DecisionExplainer();
    expect(explainer.explain({ intent: 'workspace.open' })).toContain('Cursor');
  });

  it('RecoveryAssistant should bind generic panics to UI fix suggestions', () => {
    const recovery = new RecoveryAssistant();
    const action = recovery.analyzeError(new Error('EACCES: permission denied'), {});
    expect(action?.suggestedFix).toBe('Grant Directory Access');
  });
});
