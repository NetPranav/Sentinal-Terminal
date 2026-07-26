import { AutocompleteSuggestion, AutocompleteContext, IAutocompleteProvider } from './types';

interface HistoryEntry {
  command: string;
  count: number;
  lastUsed: number;
  cwd?: string;
}

export class HistoryProvider implements IAutocompleteProvider {
  id = 'provider.history';
  enabled = true;
  
  // Mock history database
  private history: HistoryEntry[] = [
    { command: 'git status', count: 50, lastUsed: Date.now() - 1000, cwd: '/Users/pranav/Project Folder/AI Terminal' },
    { command: 'git checkout main', count: 20, lastUsed: Date.now() - 50000 },
    { command: 'npm run dev', count: 100, lastUsed: Date.now() - 2000, cwd: '/Users/pranav/Project Folder/AI Terminal' },
    { command: 'python3 main.py', count: 5, lastUsed: Date.now() - 100000 }
  ];

  async getSuggestions(context: AutocompleteContext): Promise<AutocompleteSuggestion[]> {
    const input = context.currentInput;
    if (input.length === 0) return [];

    const matches = this.history.filter(h => h.command.startsWith(input));
    
    // Ranking Algorithm based on Frequency, Recency, and CWD
    matches.sort((a, b) => {
      let scoreA = a.count * 10;
      let scoreB = b.count * 10;
      
      // Recency boost (simple linear decay mock)
      const now = Date.now();
      scoreA -= (now - a.lastUsed) / 10000; 
      scoreB -= (now - b.lastUsed) / 10000;

      // CWD context boost
      if (a.cwd === context.cwd) scoreA += 500;
      if (b.cwd === context.cwd) scoreB += 500;

      return scoreB - scoreA;
    });

    return matches.map(m => ({
      id: `hist-${m.command}`,
      value: m.command,
      category: 'History',
      priority: 90, // History is usually highest priority for shell usage
      confidence: 0.95,
      sourceProvider: this.id
    }));
  }

  public addHistory(command: string, cwd: string) {
    const existing = this.history.find(h => h.command === command);
    if (existing) {
      existing.count++;
      existing.lastUsed = Date.now();
      existing.cwd = cwd;
    } else {
      this.history.push({ command, count: 1, lastUsed: Date.now(), cwd });
    }
  }
}
