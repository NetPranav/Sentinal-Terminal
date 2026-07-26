import { AICache } from './AICache';
import { AIResponse } from '../models/AIResponse';

export class PromptCache implements AICache<AIResponse> {
  private cache = new Map<string, AIResponse>();

  get(key: string): AIResponse | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: AIResponse): void {
    // A naive LRU could be implemented here; keeping it simple for foundation
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}
