/**
 * RelationshipTypes.ts — Defined Edge Vocabularies for Knowledge Graph
 * Includes base weights to influence retrieval ranking.
 */

export const RelationshipTypes = {
  // Ownership & Containment
  BELONGS_TO: { name: 'belongs_to', baseWeight: 0.9 },
  CONTAINS: { name: 'contains', baseWeight: 0.9 },
  OWNS: { name: 'owns', baseWeight: 1.0 },

  // Execution & Environment
  RUNS: { name: 'runs', baseWeight: 0.8 },
  OPENED_IN: { name: 'opened_in', baseWeight: 0.75 },
  CONFIGURED_BY: { name: 'configured_by', baseWeight: 0.85 },
  REQUIRES: { name: 'requires', baseWeight: 0.95 },

  // Usage & Association
  USES: { name: 'uses', baseWeight: 0.7 },
  PAIRED_WITH: { name: 'paired_with', baseWeight: 0.85 },
  CONNECTED_TO: { name: 'connected_to', baseWeight: 0.8 },
  HAS_WORKFLOW: { name: 'has_workflow', baseWeight: 0.9 },

  // Social & Organizational
  WORKS_ON: { name: 'works_on', baseWeight: 0.7 },
  MEMBER_OF: { name: 'member_of', baseWeight: 0.8 },
} as const;

export type RelationshipName = typeof RelationshipTypes[keyof typeof RelationshipTypes]['name'];

/**
 * Validates if a relationship string is a known edge type.
 */
export function isValidRelationship(relationship: string): boolean {
  return Object.values(RelationshipTypes).some(r => r.name === relationship);
}

/**
 * Gets the default base weight for a relationship type.
 */
export function getBaseWeight(relationship: string): number {
  const match = Object.values(RelationshipTypes).find(r => r.name === relationship);
  return match ? match.baseWeight : 0.5;
}
