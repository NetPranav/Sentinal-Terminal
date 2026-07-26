export type ToolCategory = 'Filesystem' | 'Process' | 'Shell' | 'System' | 'Clipboard' | 'Network' | 'Git' | 'Other';
export type ToolRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'SENSITIVE' | 'UNKNOWN';

export interface ToolMetadata {
  id: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  version: string;
  risk: ToolRisk;
  permissions: string[];
  examples: string[];
  tags: string[];
  supportedPlatforms: ('macos' | 'windows' | 'linux')[];
  parametersSchema?: any; // Represented dynamically, fully strictly typed in Zod schema
  deprecationStatus?: 'stable' | 'deprecated';
}

export interface ToolDefinition extends ToolMetadata {
  // Can be loaded from JSON
}
