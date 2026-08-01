import { describe, it, expect } from 'vitest';
import { ClarificationEngine } from '../interaction/ClarificationEngine';
import { ParameterCollector } from '../interaction/ParameterCollector';
import { ExecutionPreview } from '../preview/ExecutionPreview';

describe('UX — Interaction & Preview', () => {
  it('ClarificationEngine should prompt only on ambiguity', () => {
    const engine = new ClarificationEngine();
    
    // No ambiguity
    expect(engine.resolveAmbiguity('repo', ['Terminal'])).toBeNull();
    
    // Ambiguity exists
    const prompt = engine.resolveAmbiguity('repo', ['Terminal', 'Website']);
    expect(prompt?.options.length).toBe(2);
  });

  it('ParameterCollector should dynamically generate fallback prompts', () => {
    const collector = new ParameterCollector();
    const prompts = collector.generatePrompts(['port', 'branch']);
    
    expect(prompts.length).toBe(2);
    expect(prompts[0].parameterName).toBe('port');
  });

  it('ExecutionPreview should calculate structural risk bounds', () => {
    const preview = new ExecutionPreview();
    const summary = preview.generateSummary({ actions: [1, 2, 3] });
    
    expect(summary.riskLevel).toBe('Medium');
    expect(summary.actionsCount).toBe(3);
  });
});
