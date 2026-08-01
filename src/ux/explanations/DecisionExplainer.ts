/**
 * DecisionExplainer.ts — Human-readable planner logic summaries
 */

export class DecisionExplainer {
  public explain(plannerNode: any): string {
    // In production, maps raw Planning Context into strings
    if (plannerNode?.intent === 'workspace.open') {
      return 'Opened Cursor because it is your preferred IDE.';
    }
    if (plannerNode?.intent === 'network.connect') {
      return 'Connected to the strongest known WiFi network based on previous success.';
    }
    return 'Action selected to fulfill the extracted goal efficiently.';
  }
}
