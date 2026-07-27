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
      description: 'Never delete system folders or root/home directory structures.',
      evaluate: (capId, input) => {
        if (!input) return null;

        const isDeleteCap = 
          capId === 'filesystem.delete' || 
          capId === 'filesystem.trash' || 
          capId === 'fs.delete' || 
          capId === 'fs.trash' ||
          (capId === 'fs.core' && ['delete', 'trash', 'remove', 'rm', 'rmdir'].includes(input?.operation?.toLowerCase()));

        if (isDeleteCap) {
          const rawPath = String(input.path || input.target || input.source || '').trim();
          // Remove quotes, and remove trailing slashes (unless the path is literally "/" or "//")
          const normalized = rawPath.replace(/^['"]|['"]$/g, '').replace(/(.+)\/+$/, '$1');

          const protectedRoots = [
            '/', '~', '$HOME', '${HOME}', 
            '/System', '/Windows', '/bin', '/usr', '/sbin', '/etc', '/var', '/Library'
          ];
          
          const destructiveGlobs = ['/*', '~/*', '$HOME/*', '/System/*', '/usr/*', '/bin/*', '/etc/*'];

          if (protectedRoots.includes(normalized) || destructiveGlobs.includes(rawPath)) {
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
