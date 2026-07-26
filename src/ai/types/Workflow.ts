export interface WorkflowStep {
  id: string;
  type: string;
  capabilityId: string;
  name: string;
  parameters?: Record<string, any>;
  dependencies?: string[];
}

export interface WorkflowPlan {
  id: string;
  version: string;
  name: string;
  description: string;
  createdTime: string;
  steps: WorkflowStep[];
}
