/**
 * OllamaProvider.ts — Ollama Model Provider Implementation
 * 
 * Communicates cleanly with local Ollama runtime over HTTP REST endpoints.
 */

import { ModelProvider, ModelMetadata, GenerateOptions, ProviderResponse } from './Provider';

export class OllamaProvider implements ModelProvider {
  readonly providerId = 'ollama';
  readonly providerName = 'Ollama Local Runtime';

  constructor(public baseUrl: string = 'http://localhost:11434') {}

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, { method: 'GET' });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  public async listModels(): Promise<ModelMetadata[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.models || []).map((m: any) => ({
        id: m.name,
        name: m.name,
        sizeBytes: m.size || 0,
        quantization: m.details?.quantization_level || 'unknown',
        parameterCount: m.details?.parameter_size || 'unknown',
        modifiedAt: m.modified_at,
        digest: m.digest
      }));
    } catch {
      return [];
    }
  }

  public async hasModel(modelId: string): Promise<boolean> {
    const models = await this.listModels();
    const cleanId = modelId.toLowerCase().trim();
    return models.some(m => m.id.toLowerCase() === cleanId || m.id.toLowerCase().startsWith(cleanId + ':'));
  }

  public async pullModel(modelId: string, onProgress?: (percent: number, status: string) => void): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId, stream: true })
      });

      if (!response.body) return false;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const status = parsed.status || 'Downloading...';
            let percent = 0;
            if (parsed.total && parsed.completed) {
              percent = Math.round((parsed.completed / parsed.total) * 100);
            }
            onProgress?.(percent, status);
          } catch (e) {
            // ignore incomplete line parses
          }
        }
      }
      return await this.hasModel(modelId);
    } catch (e) {
      console.error(`[OllamaProvider] Failed to pull model ${modelId}:`, e);
      return false;
    }
  }

  public async generate(prompt: string, modelId: string = 'qwen2.5:1.5b', options?: GenerateOptions): Promise<ProviderResponse> {
    const startTime = performance.now();
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        prompt,
        format: options?.format || 'json',
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.1,
          top_p: options?.topP ?? 0.9,
          num_predict: options?.maxTokens ?? 2048,
          stop: options?.stopSequences
        }
      })
    });

    const latencyMs = performance.now() - startTime;

    if (!response.ok) {
      throw new Error(`[OllamaProvider] Generation failed (${response.status}): ${response.statusText}`);
    }

    const data = await response.json() as any;
    const promptTokens = data.prompt_eval_count || 0;
    const completionTokens = data.eval_count || 0;

    return {
      content: data.response || '',
      raw: data,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      latencyMs
    };
  }
}
