/**
 * ClarificationEngine.ts — Contextual question generator for ambiguous entities
 */

export interface ClarificationPrompt {
  readonly id: string;
  readonly entityName: string;
  readonly options: string[];
  readonly question: string;
}

export class ClarificationEngine {
  public resolveAmbiguity(entityName: string, candidates: string[]): ClarificationPrompt | null {
    if (candidates.length <= 1) return null;

    return {
      id: `clarify_${Date.now()}`,
      entityName,
      options: candidates,
      question: `Multiple matches found for "${entityName}". Which one did you mean?`
    };
  }
}
