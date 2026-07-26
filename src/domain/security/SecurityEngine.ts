export type RiskLevel = 'SAFE' | 'SENSITIVE' | 'ADMIN' | 'CRITICAL' | 'UNKNOWN';

export interface RiskAnalysisResult {
  score: number; // 0-100
  level: RiskLevel;
  explanation: string;
}

export interface ISecurityEngine {
  analyzeCommand(command: string, args?: string[]): RiskAnalysisResult;
  analyzeWorkflow(actions: any[]): RiskAnalysisResult;
  calculateRisk(capabilityId: string, input: any): RiskAnalysisResult;
}

export class SecurityEngine implements ISecurityEngine {
  analyzeCommand(command: string, args: string[] = []): RiskAnalysisResult {
    const fullCmd = [command, ...args].join(' ');

    if (fullCmd.includes('sudo ') || fullCmd.includes('su ')) {
      if (fullCmd.includes('rm -rf /') || fullCmd.includes('mkfs')) {
        return { score: 100, level: 'CRITICAL', explanation: 'Destructive admin command detected.' };
      }
      return { score: 80, level: 'ADMIN', explanation: 'Administrator privileges requested.' };
    }

    if (fullCmd.startsWith('rm ')) {
      if (fullCmd.includes('*')) {
        return { score: 60, level: 'SENSITIVE', explanation: 'Mass deletion command detected.' };
      }
      return { score: 40, level: 'SENSITIVE', explanation: 'File deletion command.' };
    }

    if (fullCmd.startsWith('ls ') || fullCmd.startsWith('pwd') || fullCmd.startsWith('echo ')) {
      return { score: 5, level: 'SAFE', explanation: 'Safe read-only command.' };
    }

    return { score: 50, level: 'UNKNOWN', explanation: 'Unknown command pattern.' };
  }

  analyzeWorkflow(actions: any[]): RiskAnalysisResult {
    // In a real implementation, analyze the sequence
    // Example: Delete + Kill + Disconnect = High
    let highestScore = 0;
    
    // Simplistic mockup for workflow analysis
    if (actions.length > 5) highestScore += 20;

    return {
      score: highestScore > 100 ? 100 : highestScore,
      level: highestScore > 75 ? 'CRITICAL' : highestScore > 50 ? 'SENSITIVE' : 'SAFE',
      explanation: 'Workflow risk analyzed.'
    };
  }

  calculateRisk(capabilityId: string, input: any): RiskAnalysisResult {
    if (capabilityId === 'shell.core') {
      return this.analyzeCommand(input?.command || '', input?.args || []);
    }
    
    if (capabilityId === 'fs.core' || capabilityId.startsWith('filesystem.')) {
      const op = input?.operation || capabilityId.replace('filesystem.', '');
      const path = input?.path || input?.source || '';
      if (op === 'delete' || op === 'trash') {
        if (path === '/' || path.startsWith('/System') || path === '~' || path === '~/') {
          return { score: 100, level: 'CRITICAL', explanation: 'Attempting to delete critical system directory.' };
        }
        return { score: 85, level: 'ADMIN', explanation: 'Destructive filesystem deletion requires administrative security authorization and credential verification.' };
      }
      if (op === 'read' || op === 'list' || op === 'mkdir' || op === 'create') {
        return { score: 5, level: 'SAFE', explanation: 'Safe filesystem operation.' };
      }
    }

    return { score: 20, level: 'SAFE', explanation: 'Standard capability execution.' };
  }
}
