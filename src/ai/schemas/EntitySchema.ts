import { z } from 'zod';

export const EntitySchema = z.object({
  type: z.string(),
  value: z.string(),
  raw: z.string(),
  confidence: z.number().min(0).max(1)
});

export const ExtractedEntitiesSchema = z.record(z.string(), z.array(EntitySchema));

export type EntityData = z.infer<typeof EntitySchema>;
export type ExtractedEntitiesData = z.infer<typeof ExtractedEntitiesSchema>;
