import { z } from 'zod';
import { Workflow } from '../workflow/types';
import { ToolMetadata } from '../tool/types';

export interface PlanningRequest {
  goal: string;
  context?: Record<string, any>;
  constraints?: {
    offlineOnly?: boolean;
    noShell?: boolean;
    readOnly?: boolean;
    maxExecutionTimeMs?: number;
    safeMode?: boolean;
    noAdmin?: boolean;
    [key: string]: any;
  };
  preferences?: Record<string, any>;
}

export interface PlanningResponse {
  success: boolean;
  workflow?: Workflow;
  risk?: {
    level: 'SAFE' | 'SENSITIVE' | 'ADMIN' | 'CRITICAL' | 'UNKNOWN';
    score: number;
    explanation: string;
  };
  permissions?: string[];
  estimatedTime?: string;
  summary?: string;
  confidence?: number;
  intentResult?: {
    modelId: string;
    providerId: string;
    confidence: number;
    goal: string;
    tasks: Array<{ tool: string; entities: Record<string, any> }>;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface PlannerContext {
  request: PlanningRequest;
  availableTools: ToolMetadata[];
}

export interface IReasoningEngine {
  /**
   * Translates a goal and available capabilities into a valid executable Workflow.
   * Also returns metadata like estimated risk, permissions required, and confidence.
   */
  generatePlan(prompt: string): Promise<PlanningResponse>;
}
