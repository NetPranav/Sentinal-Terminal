/**
 * PluginTypes.ts — Core Data Models for the Plugin SDK
 */

export type PluginState = 'discover' | 'resolve' | 'load' | 'init' | 'enable' | 'running' | 'disable' | 'unload' | 'error';
export type PluginExecutionModel = 'capability' | 'workflow' | 'ui' | 'native';

export interface ResourceLimits {
  readonly memoryLimitMb?: number;
  readonly cpuLimitPercent?: number;
  readonly timeoutMs?: number;
  readonly maxThreads?: number;
  readonly maxProcesses?: number;
}

export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly description: string;
  readonly license: string;
  readonly sdkVersion: string;
  readonly entrypoint: string;
  readonly executionModel: PluginExecutionModel;
  readonly permissions: string[]; // e.g., 'filesystem.read', 'network.http'
  readonly dependencies?: Record<string, string>; // pluginId -> version range
  readonly limits?: ResourceLimits;
  readonly checksum?: string;
  readonly signature?: string;
}

export interface PluginContext {
  readonly manifest: PluginManifest;
  readonly workingDirectory: string;
  readonly storageDirectory: string;
}

export interface DependencyGraphNode {
  readonly id: string;
  readonly manifest: PluginManifest;
  readonly dependencies: string[];
  readonly dependents: string[];
}
