/**
 * Inspectors.ts — Read-Only Debug Views
 * 
 * Consumes immutable snapshots from IDebugProviders and history from TraceEngine.
 */

import { IDebugProvider } from '../providers/IDebugProvider';
import { TraceEngine } from '../tracing/TraceEngine';
import { TraceEvent, SubsystemType } from '../models/DevToolsTypes';

export class BaseInspector<TSnapshot, TConfig> {
  constructor(
    protected provider: IDebugProvider<TSnapshot, TConfig>,
    protected traceEngine: TraceEngine
  ) {}

  public getLiveSnapshot(): Readonly<TSnapshot> {
    return this.provider.getSnapshot();
  }

  public getLiveConfiguration(): Readonly<TConfig> {
    return this.provider.getConfiguration();
  }

  public getEventHistory(): ReadonlyArray<TraceEvent> {
    return this.traceEngine.getHistory().filter(e => e.subsystem === this.provider.subsystemName);
  }
}

export class ExecutionInspector extends BaseInspector<any, any> {
  public getFailedNodes(): any[] {
    // In a real implementation this would parse the snapshot
    const snap = this.getLiveSnapshot();
    return (snap.nodes || []).filter((n: any) => n.status === 'failed');
  }
}

export class MemoryInspector extends BaseInspector<any, any> {
  public getRelationshipGraph(): any {
    const snap = this.getLiveSnapshot();
    return snap.graph || { edges: [], nodes: [] };
  }
}

export class PluginInspector extends BaseInspector<any, any> {
  public getActivePlugins(): string[] {
    const snap = this.getLiveSnapshot();
    return snap.activePlugins || [];
  }
}

// ... Additional Inspectors for Planner, Workflow, Learning, State, etc. follow identical read-only patterns.
