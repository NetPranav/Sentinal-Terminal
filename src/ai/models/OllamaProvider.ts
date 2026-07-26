import { LocalModel } from './LocalModel';
import { AIResponse } from './AIResponse';
import { ModelConfig } from '../types/Model';

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export class OllamaProvider extends LocalModel {
  public baseUrl = 'http://localhost:11434';
  
  constructor(public modelName: string = 'qwen2.5:1.5b') {
    super();
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  public async listModels(): Promise<OllamaModel[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      const data = await res.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  public async hasModel(modelName: string = this.modelName): Promise<boolean> {
    const models = await this.listModels();
    return models.some(m => m.name === modelName || m.name.startsWith(modelName + ':'));
  }

  public async pullModel(modelName: string = this.modelName, onProgress?: (progress: any) => void): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      body: JSON.stringify({ name: modelName }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.body) throw new Error("No response body");
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      try {
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
          const parsed = JSON.parse(line);
          onProgress?.(parsed);
        }
      } catch (e) {
        // ignore incomplete JSON chunks
      }
    }
  }

  async generate(prompt: string, config?: Partial<ModelConfig>): Promise<AIResponse> {
    if (!this.isInitialized) await this.initialize();
    
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelName,
        prompt,
        format: 'json',
        stream: false,
        options: {
          temperature: config?.temperature ?? 0.1,
          top_p: config?.top_p ?? 0.9,
          num_predict: 2048
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama generation failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return new AIResponse(data.response, { 
      promptTokens: data.prompt_eval_count || 0, 
      completionTokens: data.eval_count || 0, 
      totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0) 
    });
  }
}
