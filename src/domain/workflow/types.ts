import { z } from 'zod';
import { RollbackAction } from '../Capability';

export type StepType = 
  | 'ExecuteCapability' 
  | 'ConditionalBranch' 
  | 'ParallelExecution' 
  | 'Delay' 
  | 'Wait' 
  | 'Retry' 
  | 'UserConfirmation' 
  | 'VariableAssignment' 
  | 'Loop' 
  | 'End';

export const retryPolicySchema = z.object({
  type: z.enum(['none', 'fixed', 'exponential']),
  maxAttempts: z.number().default(0),
  delayMs: z.number().default(0)
});

export type RetryPolicy = z.infer<typeof retryPolicySchema>;

export interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  dependencies: string[];
  
  // Specific to ExecuteCapability
  capabilityId?: string;
  parameters?: Record<string, any>;
  
  // Specific to ConditionalBranch
  condition?: {
    variable: string;
    operator: '==' | '!=' | '>' | '<' | 'exists' | 'not_exists' | 'contains';
    value?: any;
  };
  trueBranch?: string; // Step ID to execute if true
  falseBranch?: string; // Step ID to execute if false

  // Specific to VariableAssignment
  assignments?: Record<string, any>;

  // Specific to Delay
  delayMs?: number;

  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
}

export const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  createdTime: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  variables: z.record(z.string(), z.any()).default({}),
  steps: z.array(z.any()) // Using any here to bypass complex recursive zod for now, typed via interface
});

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  createdTime: string;
  metadata?: Record<string, any>;
  variables: Record<string, any>;
  steps: WorkflowStep[];
}

export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface WorkflowTaskExecution {
  stepId: string;
  status: TaskStatus;
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  output?: any;
  error?: any;
  rollbackAction?: RollbackAction;
}
