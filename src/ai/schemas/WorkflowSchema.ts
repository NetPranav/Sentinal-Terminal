import { z } from 'zod';

export const WorkflowStepSchema = z.object({
  id: z.string(),
  type: z.string(),
  capabilityId: z.string(),
  name: z.string(),
  parameters: z.record(z.string(), z.any()).optional(),
  dependencies: z.array(z.string()).optional()
});

export const WorkflowSchema = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  description: z.string(),
  createdTime: z.string(),
  steps: z.array(WorkflowStepSchema)
});

export type WorkflowData = z.infer<typeof WorkflowSchema>;
