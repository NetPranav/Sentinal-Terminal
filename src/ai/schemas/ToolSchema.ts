import { z } from 'zod';

export const ToolSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string(),
  category: z.enum(['Filesystem', 'Process', 'Shell', 'System', 'Clipboard', 'Network', 'Git', 'Other']),
  version: z.string(),
  risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'SENSITIVE', 'UNKNOWN']),
  permissions: z.array(z.string()),
  examples: z.array(z.string()),
  tags: z.array(z.string()),
  supportedPlatforms: z.array(z.enum(['macos', 'windows', 'linux'])),
  parametersSchema: z.any().optional(),
  deprecationStatus: z.enum(['stable', 'deprecated']).optional()
});

export type ToolSchemaData = z.infer<typeof ToolSchema>;
