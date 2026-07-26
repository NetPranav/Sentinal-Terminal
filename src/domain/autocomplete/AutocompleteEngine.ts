import { AutocompleteSuggestion, AutocompleteContext, IAutocompleteProvider } from './types';

export class AutocompleteEngine {
  private providers: IAutocompleteProvider[] = [];
  private lastQueryTime = 0;

  public registerProvider(provider: IAutocompleteProvider) {
    this.providers.push(provider);
  }

  public getProviders() {
    return this.providers;
  }

  /**
   * Fetches suggestions across all enabled providers in parallel,
   * with a strict latency budget.
   */
  public async getSuggestions(context: AutocompleteContext, timeoutMs: number = 15): Promise<AutocompleteSuggestion[]> {
    if (!context.currentInput || context.currentInput.trim() === '') {
      return [];
    }

    const queryTime = performance.now();
    this.lastQueryTime = queryTime;

    const enabledProviders = this.providers.filter(p => p.enabled);
    
    // Create timeout promise
    const timeoutPromise = new Promise<AutocompleteSuggestion[]>(resolve => 
      setTimeout(() => resolve([]), timeoutMs)
    );

    const providerPromises = enabledProviders.map(async p => {
      try {
        return await p.getSuggestions(context);
      } catch {
        return []; // Swallow errors to not crash the engine
      }
    });

    // Race each provider against the timeout so slow providers drop out cleanly
    const results = await Promise.all(
      providerPromises.map(p => Promise.race([p, timeoutPromise]))
    );

    // If a newer query has happened while we were waiting, discard these results
    if (this.lastQueryTime !== queryTime) {
      return [];
    }

    const allSuggestions = results.flat();
    return this.rankSuggestions(allSuggestions);
  }

  private rankSuggestions(suggestions: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
    // Basic ranking formula taking priority and confidence into account
    return suggestions.sort((a, b) => {
      const scoreA = (a.priority * 10) + (a.confidence * 100);
      const scoreB = (b.priority * 10) + (b.confidence * 100);
      return scoreB - scoreA;
    });
  }
}
