import { z } from 'zod';

export const IntentSchema = z.object({
  domain: z.string(),
  action: z.string(),
  confidence: z.number().min(0).max(1)
});

export type IntentData = z.infer<typeof IntentSchema>;
