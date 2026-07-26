import { AIResponse } from './AIResponse';
import { ModelConfig } from '../types/Model';

export interface AIProvider {
  initialize(): Promise<void>;
  generate(prompt: string, config?: Partial<ModelConfig>): Promise<AIResponse>;
  stream?(prompt: string, config?: Partial<ModelConfig>): AsyncGenerator<string, void, unknown>;
  dispose(): Promise<void>;
}
