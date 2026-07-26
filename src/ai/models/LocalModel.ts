import { AIProvider } from './AIProvider';
import { AIResponse } from './AIResponse';
import { ModelConfig } from '../types/Model';

export abstract class LocalModel implements AIProvider {
  protected isInitialized = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  abstract generate(prompt: string, config?: Partial<ModelConfig>): Promise<AIResponse>;
  
  async dispose(): Promise<void> {
    this.isInitialized = false;
  }
}
