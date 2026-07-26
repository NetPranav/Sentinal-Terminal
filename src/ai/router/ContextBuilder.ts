import { AIContext } from '../types/AI';

export class ContextBuilder {
  public static buildEnvironmentContext(baseContext?: AIContext): string {
    const os = baseContext?.os || 'mac';
    const cwd = (baseContext?.cwd && baseContext.cwd !== 'unknown') ? baseContext.cwd : '~';
    const shell = baseContext?.shell || 'zsh';
    
    return `Operating System: ${os}\nWorking Directory: ${cwd}\nShell: ${shell}`;
  }
}
