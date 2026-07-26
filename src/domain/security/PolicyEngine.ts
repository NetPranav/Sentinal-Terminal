export type PolicyResult = 'Allow' | 'Deny' | 'Ask' | 'Conditional';

export interface PolicyRule {
  id: string;
  description: string;
  evaluate: (capabilityId: string, input: any) => PolicyResult | null; // null if rule doesn't apply
}

export interface IPolicyEngine {
  evaluate(capabilityId: string, input: any): PolicyResult;
  addRule(rule: PolicyRule): void;
}

export class PolicyEngine implements IPolicyEngine {
  private rules: PolicyRule[] = [];

  constructor() {
    this.registerDefaultRules();
  }

  private registerDefaultRules() {
    this.addRule({
      id: 'no-sudo-auto',
      description: 'Never execute sudo automatically without asking.',
      evaluate: (capId, input) => {
        if (capId === 'shell.core' && input.command && input.command.includes('sudo ')) {
          return 'Ask'; // Force ask
        }
        return null;
      }
    });

    this.addRule({
      id: 'protect-system-dirs',
      description: 'Never delete system folders.',
      evaluate: (capId, input) => {
        if (capId === 'fs.core' && input.operation === 'delete') {
          if (['/', '/System', '/Windows', '/bin', '/usr'].includes(input.path)) {
            return 'Deny';
          }
        }
        return null;
      }
    });
  }

  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }

  evaluate(capabilityId: string, input: any): PolicyResult {
    let finalResult: PolicyResult = 'Allow';

    for (const rule of this.rules) {
      const result = rule.evaluate(capabilityId, input);
      if (result === 'Deny') return 'Deny'; // Deny overrides everything immediately
      if (result === 'Ask') finalResult = 'Ask'; // Ask overrides Allow
      if (result === 'Conditional' && finalResult === 'Allow') finalResult = 'Conditional';
    }

    return finalResult;
  }
}
