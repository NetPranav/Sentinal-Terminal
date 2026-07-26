import { AutocompleteSuggestion, AutocompleteContext, IAutocompleteProvider } from './types';
import { CapabilityManager } from '../Capability';

export class CapabilityProvider implements IAutocompleteProvider {
  id = 'provider.capability';
  enabled = true;

  constructor(private capabilityManager: CapabilityManager) {}

  async getSuggestions(context: AutocompleteContext): Promise<AutocompleteSuggestion[]> {
    const input = context.currentInput.toLowerCase();
    
    // Only trigger natural language suggestions if the input looks like natural language
    // (e.g. starts with capital letter, contains spaces, or specific action verbs)
    // For now, we'll do a simple substring match on capability names and descriptions.
    if (input.length < 3) return [];

    const capabilities = this.capabilityManager.getRegistry().list();
    const suggestions: AutocompleteSuggestion[] = [];

    for (const cap of capabilities) {
      if (cap.name.toLowerCase().includes(input) || cap.description.toLowerCase().includes(input)) {
        // Natural language suggestion Ghost text would be the full name or an example intent
        suggestions.push({
          id: `cap-${cap.id}`,
          value: cap.name, // The user will accept "Disconnect Wi-Fi"
          description: cap.description,
          category: 'Capability',
          priority: 80,
          confidence: 0.8,
          sourceProvider: this.id
        });
      }
    }

    return suggestions;
  }
}
