import { CapabilityManager, CapabilityResult } from '../Capability';
import { IPermissionManager, PermissionCategory } from './PermissionManager';
import { ISecurityEngine } from './SecurityEngine';
import { IPolicyEngine } from './PolicyEngine';
import { IAuditLogger } from './AuditLogger';
import { CapabilityRegistrySDK } from '../../sdk/capabilities/CapabilityRegistrySDK';

export interface ExecutionOptions {
  isDryRun?: boolean;
  skipPreview?: boolean; // For automated workflows where 'Ask' might trigger UI if not skipped
  onAskPermission?: (plan: ExecutionPreviewPlan) => Promise<boolean>;
}

export interface ExecutionPreviewPlan {
  capabilityId: string;
  parameters: any;
  riskLevel: string;
  riskScore: number;
  permissionsRequired: string[];
  explanation: string;
}

export class ExecutionEngine {
  constructor(
    private capabilityManager: CapabilityManager,
    private permissionManager: IPermissionManager,
    private securityEngine: ISecurityEngine,
    private policyEngine: IPolicyEngine,
    private auditLogger: IAuditLogger
  ) {}

  public async execute<I, O>(
    capabilityId: string, 
    input: I, 
    options: ExecutionOptions = {}
  ): Promise<CapabilityResult<O>> {
    const startTime = performance.now();
    const capability = this.capabilityManager.getRegistry().get(capabilityId);

    if (!capability) {
      const sdkDriver = CapabilityRegistrySDK.getInstance().getDriver(capabilityId);
      if (sdkDriver) {
        const risk = this.securityEngine.calculateRisk(capabilityId, input);
        const needsAsk = risk.level === 'CRITICAL' || risk.level === 'ADMIN' || capabilityId === 'filesystem.delete' || capabilityId === 'filesystem.trash';
        if (needsAsk && options.onAskPermission) {
          const plan: ExecutionPreviewPlan = {
            capabilityId,
            parameters: input,
            riskLevel: risk.level,
            riskScore: risk.score,
            permissionsRequired: ['filesystem.admin'],
            explanation: risk.explanation
          };
          const approved = await options.onAskPermission(plan);
          if (!approved) {
            await this.logAudit(capabilityId, input, risk.score, 'Denied', startTime);
            return this.errorResult('USER_CANCELLED', 'User cancelled the execution plan.', startTime);
          }
        }
        const res = await sdkDriver.execute(input, { isDryRun: options.isDryRun });
        const isVerified = res.success ? await sdkDriver.verify(input, res) : false;
        await this.logAudit(capabilityId, input, risk.score || 10, 'Granted', startTime, isVerified ? 'Success' : 'NotApplicable', !!res.rollbackPayload);
        return {
          success: res.success,
          data: res.data as O,
          error: res.error,
          executionTimeMs: res.executionTimeMs || (performance.now() - startTime),
          rollbackAction: res.rollbackPayload ? {
            description: `Rollback ${capabilityId}`,
            executeRollback: async () => await sdkDriver.rollback(input, res)
          } : undefined
        };
      }
      return this.errorResult('CAP_NOT_FOUND', `Capability '${capabilityId}' not found.`, startTime);
    }

    try {
      // 1. Validate Input (Zod)
      if (capability.inputSchema) {
        const parseResult = capability.inputSchema.safeParse(input);
        if (!parseResult.success) {
          return this.errorResult('VALIDATION_FAILED', 'Input schema validation failed', startTime, (parseResult.error as any).issues || (parseResult.error as any).errors);
        }
      }

      // 2. Check Policy
      const policyResult = this.policyEngine.evaluate(capabilityId, input);
      if (policyResult === 'Deny') {
        await this.logAudit(capabilityId, input, 100, 'Denied', startTime);
        return this.errorResult('POLICY_DENIED', 'Execution denied by policy rules.', startTime);
      }

      // 3. Risk Analysis
      const risk = this.securityEngine.calculateRisk(capabilityId, input);

      // 4. Check Permissions
      let permissionResult: 'Granted' | 'Denied' | 'Bypassed' = 'Granted';
      let needsAsk = policyResult === 'Ask' || risk.level === 'CRITICAL' || risk.level === 'ADMIN';

      for (const requiredPerm of capability.metadata.requiredPermissions) {
        // Simple mapping, assuming requiredPerm maps to PermissionCategory
        const state = this.permissionManager.checkPermission(requiredPerm as PermissionCategory);
        if (state === 'AlwaysDeny') {
          await this.logAudit(capabilityId, input, risk.score, 'Denied', startTime);
          return this.errorResult('PERMISSION_DENIED', `Permission ${requiredPerm} is always denied.`, startTime);
        }
        if (state === 'AskEveryTime') {
          needsAsk = true;
        }
      }

      // 5. Preview & Ask User
      if (needsAsk) {
        if (!options.onAskPermission) {
           return this.errorResult('PERMISSION_REQUIRED', 'Interactive permission required but no UI callback provided.', startTime);
        }

        const plan: ExecutionPreviewPlan = {
          capabilityId,
          parameters: input,
          riskLevel: risk.level,
          riskScore: risk.score,
          permissionsRequired: capability.metadata.requiredPermissions,
          explanation: risk.explanation
        };

        const approved = await options.onAskPermission(plan);
        if (!approved) {
          await this.logAudit(capabilityId, input, risk.score, 'Denied', startTime);
          return this.errorResult('USER_CANCELLED', 'User cancelled the execution plan.', startTime);
        }
      }

      // 6. Dry Run Support
      if (options.isDryRun) {
        if (!capability.supportsDryRun) {
           return this.errorResult('DRY_RUN_UNSUPPORTED', 'This capability does not support dry run simulation.', startTime);
        }
        // Assuming capability.execute uses second param for dry run flag
        const result = await capability.execute(input, true);
        await this.logAudit(capabilityId, input, risk.score, 'Granted', startTime, result.success ? 'Success' : 'Failure');
        return result;
      }

      // 7. Execute
      const result = await capability.execute(input);

      // 8. Verify
      let verifyResult: 'Success' | 'Failure' | 'NotApplicable' = 'NotApplicable';
      if (result.success && capability.verify) {
        try {
          const verified = await capability.verify(input, result);
          if (!verified) {
             verifyResult = 'Failure';
             return this.errorResult('VERIFICATION_FAILED', 'Capability executed but verification failed.', startTime, undefined, result.rollbackAction);
          }
          verifyResult = 'Success';
        } catch (e: any) {
          verifyResult = 'Failure';
        }
      }

      // 9. Audit Log
      await this.logAudit(capabilityId, input, risk.score, 'Granted', startTime, verifyResult, !!result.rollbackAction);

      result.executionTimeMs = performance.now() - startTime;
      return result;

    } catch (e: any) {
      return this.errorResult('UNEXPECTED_ERROR', e.message || 'Unknown execution engine error', startTime);
    }
  }

  private async logAudit(
    capabilityId: string, 
    input: any, 
    riskScore: number, 
    permissionResult: 'Granted' | 'Denied' | 'Bypassed', 
    startTime: number,
    verificationResult: 'Success' | 'Failure' | 'NotApplicable' = 'NotApplicable',
    rollbackAvailable: boolean = false
  ) {
    const executionTimeMs = performance.now() - startTime;
    await this.auditLogger.log({
      capabilityId,
      parameters: input,
      riskScore,
      permissionResult,
      executionTimeMs,
      verificationResult,
      rollbackAvailable,
      userConfirmation: permissionResult === 'Granted' // Simplifying for now
    });
  }

  private errorResult(code: string, message: string, startTime: number, details?: any, rollbackAction?: any): CapabilityResult<any> {
    return {
      success: false,
      error: { code, message, details },
      executionTimeMs: performance.now() - startTime,
      rollbackAction
    };
  }
}
