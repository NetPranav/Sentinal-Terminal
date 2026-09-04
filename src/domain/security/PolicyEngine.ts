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
          let clean = rawPath.replace(/^['"]|['"]$/g, '').trim().replace(/(.+)\/+$/, '$1');

          // Normalize dot-segments (../) to prevent directory traversal bypasses
          if (clean.startsWith('/')) {
            const parts = clean.split(/\/+/);
            const resolved: string[] = [];
            for (const part of parts) {
              if (part === '' || part === '.') continue;
              if (part === '..') {
                resolved.pop();
              } else {
                resolved.push(part);
              }
            }
            clean = '/' + resolved.join('/');
          }

          const normalized = clean;

          const protectedRoots = [
            '/', '~', '$HOME', '${HOME}', 
            '/System', '/Windows', '/bin', '/usr', '/sbin', '/etc', '/var', '/Library'
          ];
          
          const destructiveGlobs = ['/*', '~/*', '$HOME/*', '/System/*', '/usr/*', '/bin/*', '/etc/*'];

          for (const root of protectedRoots) {
            if (root === '/' || root === '~' || root === '$HOME' || root === '${HOME}') {
              if (normalized === root) return 'Deny';
            } else {
              if (normalized === root || normalized.startsWith(root + '/')) {
                return 'Deny';
              }
            }
          }

          if (destructiveGlobs.includes(rawPath) || destructiveGlobs.includes(normalized)) {
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
