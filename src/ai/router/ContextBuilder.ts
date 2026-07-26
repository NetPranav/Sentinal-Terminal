import { AIContext } from '../types/AI';

export class ContextBuilder {
  public static buildEnvironmentContext(baseContext?: AIContext): string {
    const os = baseContext?.os || 'unknown';
    const cwd = baseContext?.cwd || 'unknown';
    const shell = baseContext?.shell || 'unknown';
    
    return `Operating System: ${os}\nWorking Directory: ${cwd}\nShell: ${shell}`;
  }
}
