import { z } from 'zod';
import { WorkflowSchema } from './WorkflowSchema';

export const AIReasoningResponseSchema = z.object({
  success: z.boolean(),
  workflow: WorkflowSchema.optional(),
  summary: z.string(),
  confidence: z.number().min(0).max(100),
  estimatedTime: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  risk: z.object({
    level: z.string(),
    score: z.number(),
    explanation: z.string()
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string()
  }).optional()
});

export type AIReasoningResponseData = z.infer<typeof AIReasoningResponseSchema>;
