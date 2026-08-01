import { z } from 'zod';

/**
 * EntitySchemas.ts — Strongly Typed Schemas for Memory Graph Entities
 * Defines the 18 core entities capable of existing as nodes in the Knowledge Graph.
 */

export const ProjectSchema = z.object({
  name: z.string(),
  path: z.string().optional(),
  language: z.string().optional(),
  status: z.enum(['active', 'archived', 'planning']).default('active'),
});

export const RepositorySchema = z.object({
  url: z.string(),
  branch: z.string().default('main'),
  remote: z.string().default('origin'),
});

export const FolderSchema = z.object({
  absolutePath: z.string(),
  purpose: z.string().optional(),
});

export const ApplicationSchema = z.object({
  name: z.string(),
  bundleId: z.string().optional(),
  path: z.string().optional(),
});

export const WorkflowSchema = z.object({
  workflowId: z.string(),
  name: z.string(),
  category: z.string().optional(),
});

export const DeviceSchema = z.object({
  name: z.string(),
  type: z.string(),
  os: z.string().optional(),
});

export const BluetoothDeviceSchema = z.object({
  name: z.string(),
  macAddress: z.string(),
  type: z.string().optional(),
});

export const WifiNetworkSchema = z.object({
  ssid: z.string(),
  security: z.string().default('WPA2'),
  known: z.boolean().default(true),
});

export const PersonSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
  email: z.string().email().optional(),
});

export const OrganizationSchema = z.object({
  name: z.string(),
  domain: z.string().optional(),
});

export const EnvironmentVariableSchema = z.object({
  key: z.string(),
  valueHash: z.string().optional(), // Store hash, not raw secret
  description: z.string().optional(),
});

export const ShellProfileSchema = z.object({
  shell: z.enum(['zsh', 'bash', 'fish']),
  configPath: z.string(),
});

export const PortSchema = z.object({
  number: z.number().int().min(1).max(65535),
  protocol: z.enum(['tcp', 'udp']).default('tcp'),
});

export const ServiceSchema = z.object({
  name: z.string(),
  type: z.string(),
  status: z.string(),
});

export const ContainerSchema = z.object({
  containerId: z.string(),
  image: z.string(),
  status: z.string(),
});

export const GitBranchSchema = z.object({
  name: z.string(),
  repositoryPath: z.string(),
});

export const WebsiteSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
});

export const DocumentSchema = z.object({
  title: z.string(),
  path: z.string().optional(),
  format: z.string().optional(),
});

export const EntitySchemas = {
  Project: ProjectSchema,
  Repository: RepositorySchema,
  Folder: FolderSchema,
  Application: ApplicationSchema,
  Workflow: WorkflowSchema,
  Device: DeviceSchema,
  BluetoothDevice: BluetoothDeviceSchema,
  WiFiNetwork: WifiNetworkSchema,
  Person: PersonSchema,
  Organization: OrganizationSchema,
  EnvironmentVariable: EnvironmentVariableSchema,
  ShellProfile: ShellProfileSchema,
  Port: PortSchema,
  Service: ServiceSchema,
  Container: ContainerSchema,
  GitBranch: GitBranchSchema,
  Website: WebsiteSchema,
  Document: DocumentSchema,
};

export type SupportedEntityType = keyof typeof EntitySchemas;
