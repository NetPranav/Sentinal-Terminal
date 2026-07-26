export type RiskLevel = 'SAFE' | 'SENSITIVE' | 'ADMIN' | 'CRITICAL' | 'UNKNOWN';

export interface RiskAnalysisResult {
  score: number; // 0-100
  level: RiskLevel;
  explanation: string;
  requiresPassword?: boolean;
  requiresConsent?: boolean;
}

export interface ISecurityEngine {
  analyzeCommand(command: string, args?: string[]): RiskAnalysisResult;
  analyzeWorkflow(actions: any[]): RiskAnalysisResult;
  calculateRisk(capabilityId: string, input: any): RiskAnalysisResult;
}

export class SecurityEngine implements ISecurityEngine {
  analyzeCommand(command: string, args: string[] = []): RiskAnalysisResult {
    const fullCmd = [command, ...args].join(' ');
    const lowerCmd = fullCmd.toLowerCase();

    // 1. Super-User / Administrator Commands
    if (lowerCmd.includes('sudo ') || lowerCmd.includes('su ') || lowerCmd.startsWith('sudo') || lowerCmd.includes('chown ') || lowerCmd.includes('chmod ')) {
      if (lowerCmd.includes('rm ') || lowerCmd.includes('mkfs') || lowerCmd.includes('dd ')) {
        return { 
          score: 100, 
          level: 'CRITICAL', 
          explanation: 'Destructive super-user system command detected. Mandatory user consent and password authentication required.',
          requiresPassword: true,
          requiresConsent: true
        };
      }
      return { 
        score: 90, 
        level: 'ADMIN', 
        explanation: 'Super-user / administrative privilege elevation detected. Password and explicit user consent required.',
        requiresPassword: true,
        requiresConsent: true
      };
    }

    // 2. Destructive Deletions (Filesystem, Rm, Trash, Rmdir, Unlink)
    if (lowerCmd.startsWith('rm ') || lowerCmd.includes(' rm ') || lowerCmd.startsWith('rmdir') || lowerCmd.includes('trash') || lowerCmd.includes('unlink')) {
      return { 
        score: 95, 
        level: 'CRITICAL', 
        explanation: 'Filesystem deletion or trash operation detected. Deleting anything strictly requires explicit user consent and password authentication.',
        requiresPassword: true,
        requiresConsent: true
      };
    }

    // 3. Mid-Level System Commands (Process termination, Network/Hardware toggles, Daemons)
    if (lowerCmd.startsWith('kill') || lowerCmd.includes(' kill ') || lowerCmd.startsWith('pkill') || lowerCmd.includes('pkill ') || lowerCmd.startsWith('killall') || lowerCmd.includes('ifconfig') || lowerCmd.includes('systemctl') || lowerCmd.includes('service ')) {
      return { 
        score: 85, 
        level: 'ADMIN', 
        explanation: 'Mid-level operating system modification or process termination detected. User consent and password authentication strictly required.',
        requiresPassword: true,
        requiresConsent: true
      };
    }

    // 4. Safe Read-Only Commands
    if (lowerCmd.startsWith('ls ') || lowerCmd.startsWith('ls') || lowerCmd.startsWith('pwd') || lowerCmd.startsWith('echo ') || lowerCmd.startsWith('cat ') || lowerCmd.startsWith('whoami')) {
      return { score: 5, level: 'SAFE', explanation: 'Safe read-only system command.', requiresPassword: false, requiresConsent: false };
    }

    return { score: 50, level: 'UNKNOWN', explanation: 'Standard terminal utility execution.', requiresPassword: false, requiresConsent: false };
  }

  analyzeWorkflow(actions: any[]): RiskAnalysisResult {
    let highestScore = 0;
    let requiresPassword = false;
    let requiresConsent = false;

    for (const action of actions) {
      const id = action?.capabilityId || action?.tool || '';
      const risk = this.calculateRisk(id, action?.parameters || action?.entities || {});
      if (risk.score > highestScore) highestScore = risk.score;
      if (risk.requiresPassword) requiresPassword = true;
      if (risk.requiresConsent) requiresConsent = true;
    }
    
    if (actions.length > 5) highestScore += 10;

    return {
      score: highestScore > 100 ? 100 : highestScore,
      level: highestScore >= 80 ? 'CRITICAL' : highestScore > 50 ? 'SENSITIVE' : 'SAFE',
      explanation: requiresPassword ? 'Workflow contains deletion, super-user, or mid-level system commands requiring password authentication and consent.' : 'Workflow risk analyzed.',
      requiresPassword,
      requiresConsent
    };
  }

  calculateRisk(capabilityId: string, input: any): RiskAnalysisResult {
    if (capabilityId === 'shell.core' || capabilityId === 'shell.execute' || capabilityId === 'terminal.run') {
      return this.analyzeCommand(input?.command || input?.cmd || '', input?.args || []);
    }
    
    // 1. Filesystem Deletions and Modifications
    if (capabilityId === 'fs.core' || capabilityId.startsWith('filesystem.')) {
      const op = (input?.operation || capabilityId.replace('filesystem.', '')).toLowerCase();
      const path = String(input?.path || input?.source || input?.target || '');
      if (op === 'delete' || op === 'trash' || op === 'remove' || op === 'rm' || op === 'rmdir') {
        return { 
          score: 100, 
          level: 'CRITICAL', 
          explanation: `Destructive filesystem deletion (${op}) on '${path}'. All deletion operations strictly require explicit user consent and password authentication.`,
          requiresPassword: true,
          requiresConsent: true
        };
      }
      if (op === 'permissions' || op === 'chmod' || op === 'chown' || op === 'move' || op === 'rename') {
        return {
          score: 80,
          level: 'ADMIN',
          explanation: `Filesystem alteration (${op}) on '${path}'. Mid-level file modifications require user consent and password authentication.`,
          requiresPassword: true,
          requiresConsent: true
        };
      }
      if (op === 'read' || op === 'list' || op === 'mkdir' || op === 'create' || op === 'cd' || op === 'navigate' || op === 'search' || op === 'locate_files') {
        return { score: 5, level: 'SAFE', explanation: 'Safe non-destructive filesystem read/navigation operation.', requiresPassword: false, requiresConsent: false };
      }
    }

    // 2. Mid-Level Process & Application Management
    if (capabilityId.startsWith('system.') || capabilityId.startsWith('application.') || capabilityId.startsWith('process.')) {
      const action = capabilityId.toLowerCase();
      if (action.includes('kill') || action.includes('stop') || action.includes('terminate') || action.includes('close') || action.includes('restart') || action.includes('shutdown') || input?.command?.includes('pkill')) {
        return {
          score: 85,
          level: 'ADMIN',
          explanation: `Mid-level process control or application termination (${capabilityId}) detected. Explicit user consent and password authentication are strictly required.`,
          requiresPassword: true,
          requiresConsent: true
        };
      }
    }

    // 3. Mid-Level Network & Hardware Controls
    if (capabilityId.startsWith('network.') || capabilityId.startsWith('bluetooth.') || capabilityId.startsWith('hardware.')) {
      const action = capabilityId.toLowerCase();
      if (action.includes('toggle') || action.includes('off') || action.includes('on') || action.includes('disconnect') || action.includes('bind') || action.includes('config')) {
        return {
          score: 80,
          level: 'ADMIN',
          explanation: `Mid-level network/hardware system configuration (${capabilityId}) detected. Requires user consent and password authentication.`,
          requiresPassword: true,
          requiresConsent: true
        };
      }
    }

    return { score: 20, level: 'SAFE', explanation: 'Standard read-only or low-risk capability execution.', requiresPassword: false, requiresConsent: false };
  }
}
