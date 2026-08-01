/**
 * SDKBridge.ts — Security Boundary Proxy
 * 
 * Intercepts calls from the Plugin Sandbox to the Core SDK.
 * Evaluates fine-grained permissions before forwarding.
 */

import { PermissionManager } from '../permissions/PermissionManager';
import { ExtensionPoints, HookEventName, HookCallback } from '../hooks/ExtensionPoints';

export class SDKBridge {
  constructor(
    private pluginId: string,
    private permissionManager: PermissionManager,
    private extensionPoints: ExtensionPoints,
    // Dependency injection points for Core Registries would go here
    // e.g., actionRegistry, capabilityRegistry, memoryStore
  ) {}

  public registerAction(actionDef: any): void {
    this.permissionManager.assertPermission(this.pluginId, 'core.action.register');
    // Forward to Core ActionRegistry
  }

  public registerCapability(capabilityDef: any): void {
    this.permissionManager.assertPermission(this.pluginId, 'core.capability.register');
    // Forward to Core CapabilityRegistry
  }

  public registerCollector(collectorDef: any): void {
    this.permissionManager.assertPermission(this.pluginId, 'core.collector.register');
    // Forward to StateEngine
  }

  public registerWorkflowTemplate(templateDef: any): void {
    this.permissionManager.assertPermission(this.pluginId, 'core.workflow.register');
    // Forward to WorkflowRegistry
  }

  public subscribeHook(event: HookEventName, callback: HookCallback): void {
    this.permissionManager.assertPermission(this.pluginId, 'core.hook.subscribe');
    // Safely wrap the callback so errors inside don't bleed back
    const safeCallback = async (ctx: any) => {
      try {
        await callback(ctx);
      } catch (e) {
        throw new Error(`Plugin ${this.pluginId} failed during hook ${event}: ${e}`);
      }
    };
    this.extensionPoints.subscribe(event, safeCallback);
  }

  // Example OS Capability Proxies
  public async executeFilesystem(op: string, params: any): Promise<any> {
    if (op === 'read') this.permissionManager.assertPermission(this.pluginId, 'filesystem.read');
    if (op === 'write') this.permissionManager.assertPermission(this.pluginId, 'filesystem.write');
    if (op === 'delete') this.permissionManager.assertPermission(this.pluginId, 'filesystem.delete');
    
    // Bridge to actual OS capability
    return { success: true, op, params };
  }
}
