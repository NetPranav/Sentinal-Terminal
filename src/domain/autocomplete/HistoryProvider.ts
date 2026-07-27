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
  
  // Enriched default history database for intelligent developer & AI command suggestions
  private history: HistoryEntry[] = [
    { command: 'git status', count: 50, lastUsed: Date.now() - 1000, cwd: '/Users/pranav/Project Folder/AI Terminal' },
    { command: 'git checkout main', count: 20, lastUsed: Date.now() - 50000 },
    { command: 'git add -A', count: 18, lastUsed: Date.now() - 60000 },
    { command: 'git commit -m ""', count: 15, lastUsed: Date.now() - 70000 },
    { command: 'git pull origin main', count: 14, lastUsed: Date.now() - 80000 },
    { command: 'git push origin main', count: 12, lastUsed: Date.now() - 90000 },
    { command: 'npm run dev', count: 100, lastUsed: Date.now() - 2000, cwd: '/Users/pranav/Project Folder/AI Terminal' },
    { command: 'npm run build', count: 80, lastUsed: Date.now() - 3000 },
    { command: 'npm test', count: 70, lastUsed: Date.now() - 4000 },
    { command: 'python3 main.py', count: 5, lastUsed: Date.now() - 100000 },
    // Explicit > AI Intent suggestions
    { command: '>open safari', count: 45, lastUsed: Date.now() - 5000 },
    { command: '>open spotify', count: 35, lastUsed: Date.now() - 6000 },
    { command: '>open vs code', count: 35, lastUsed: Date.now() - 7000 },
    { command: '>open chrome', count: 30, lastUsed: Date.now() - 8000 },
    { command: '>list running applications', count: 48, lastUsed: Date.now() - 4000 },
    { command: '>what time is it', count: 30, lastUsed: Date.now() - 9000 },
    { command: '>who am i', count: 25, lastUsed: Date.now() - 10000 },
    { command: '>check wifi connection', count: 30, lastUsed: Date.now() - 11000 },
    { command: '>check bluetooth devices', count: 25, lastUsed: Date.now() - 12000 },
    { command: '>check battery status', count: 25, lastUsed: Date.now() - 13000 },
    { command: '>kill process', count: 20, lastUsed: Date.now() - 14000 },
    { command: '>clear terminal', count: 50, lastUsed: Date.now() - 1500 },
    // Standard system utility suggestions
    { command: 'ls -la', count: 60, lastUsed: Date.now() - 2500 },
    { command: 'cd ~', count: 40, lastUsed: Date.now() - 3500 },
    { command: 'clear', count: 90, lastUsed: Date.now() - 1500 },
    { command: 'docker ps', count: 25, lastUsed: Date.now() - 20000 },
    { command: 'cat README.md', count: 15, lastUsed: Date.now() - 30000 },
    { command: 'source venv/bin/activate', count: 15, lastUsed: Date.now() - 40000 }
  ];

  async getSuggestions(context: AutocompleteContext): Promise<AutocompleteSuggestion[]> {
    const input = context.currentInput.trimStart();
    if (input.length === 0) return [];

    const matches = this.history.filter(h => h.command.toLowerCase().startsWith(input.toLowerCase()));
    
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
      priority: 90,
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
