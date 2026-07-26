export interface AutocompleteSuggestion {
  id: string;
  value: string;         // The text to insert (e.g. "git status")
  displayText?: string;  // What to display if different from value
  description?: string;
  category: 'History' | 'Shell' | 'Filesystem' | 'Capability' | 'Workflow' | 'AI' | 'Other';
  priority: number;      // Higher is better
  confidence: number;    // 0.0 to 1.0
  sourceProvider: string;
}

export interface AutocompleteContext {
  currentInput: string;
  cursorPosition: number;
  cwd: string;
  os: 'macos' | 'windows' | 'linux';
}

export interface IAutocompleteProvider {
  id: string;
  enabled: boolean;
  getSuggestions(context: AutocompleteContext): Promise<AutocompleteSuggestion[]>;
}
