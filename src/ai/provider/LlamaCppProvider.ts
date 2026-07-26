/**
 * LlamaCppProvider.ts — llama.cpp / Local Server Provider Implementation
 * 
 * Communicates with embedded or local HTTP llama.cpp runtime servers for ultra-fast Apple Silicon GGUF inference.
 */

import { ModelProvider, ModelMetadata, GenerateOptions, ProviderResponse } from './Provider';

export class LlamaCppProvider implements ModelProvider {
  readonly providerId = 'llamacpp';
  readonly providerName = 'llama.cpp Local Runtime';

  constructor(public baseUrl: string = 'http://localhost:8080') {}

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET' });
      return res.status === 200;
    } catch {
      try {
        const altRes = await fetch(`${this.baseUrl}/v1/models`, { method: 'GET' });
        return altRes.status === 200;
      } catch {
        return false;
      }
    }
  }

  public async listModels(): Promise<ModelMetadata[]> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`);
      if (!res.ok) {
        // Return default single running instance metadata if server doesn't expose list
        return [{
          id: 'llamacpp-active-model',
          name: 'Active GGUF Model',
          sizeBytes: 0,
          quantization: 'GGUF'
        }];
      }
      const data = await res.json() as any;
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        sizeBytes: 0,
        quantization: 'GGUF'
      }));
    } catch {
      return [];
    }
  }

  public async hasModel(modelId: string): Promise<boolean> {
    const models = await this.listModels();
    if (models.length > 0 && models[0].id === 'llamacpp-active-model') return true;
    const cleanId = modelId.toLowerCase().trim();
    return models.some(m => m.id.toLowerCase().includes(cleanId));
  }

  public async pullModel(modelId: string, onProgress?: (percent: number, status: string) => void): Promise<boolean> {
    // For standalone llama.cpp server, models are loaded via command-line arguments or local GGUF downloaders
    onProgress?.(100, `Model ${modelId} assumed active or downloaded locally.`);
    return true;
  }

  public async generate(prompt: string, modelId?: string, options?: GenerateOptions): Promise<ProviderResponse> {
    const startTime = performance.now();
    const response = await fetch(`${this.baseUrl}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        n_predict: options?.maxTokens ?? 2048,
        temperature: options?.temperature ?? 0.1,
        top_p: options?.topP ?? 0.9,
        stop: options?.stopSequences || ['\n\n\n'],
        grammar: options?.grammarJsonSchema ? undefined : undefined // Can pass BNF grammar string if formatted
      })
    });

    const latencyMs = performance.now() - startTime;

    if (!response.ok) {
      throw new Error(`[LlamaCppProvider] Generation failed (${response.status}): ${response.statusText}`);
    }

    const data = await response.json() as any;
    const content = data.content || data.text || '';

    return {
      content,
      raw: data,
      usage: {
        promptTokens: data.tokens_evaluated || 0,
        completionTokens: data.tokens_predicted || 0,
        totalTokens: (data.tokens_evaluated || 0) + (data.tokens_predicted || 0)
      },
      latencyMs
    };
  }
}
