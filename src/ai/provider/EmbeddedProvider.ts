/**
 * EmbeddedProvider.ts — Embedded llama.cpp Model Provider
 * 
 * Communicates with a bundled llama-server sidecar binary that ships inside
 * the Sentinel Terminal .app bundle. This eliminates the need for users to 
 * install Ollama or any external dependency.
 * 
 * Lifecycle:
 * 1. On app launch, Tauri spawns the llama-server sidecar with the bundled GGUF model
 * 2. EmbeddedProvider connects to localhost:8847 (dedicated port, won't conflict with Ollama)
 * 3. On app quit, Tauri kills the sidecar process
 * 
 * Fallback: If embedded model is unavailable, ModelManager falls back to OllamaProvider.
 */

import { ModelProvider, ModelMetadata, GenerateOptions, ProviderResponse } from './Provider';

const EMBEDDED_PORT = 8847;
const EMBEDDED_BASE_URL = `http://localhost:${EMBEDDED_PORT}`;
const HEALTH_TIMEOUT_MS = 2000;
const MAX_HEALTH_RETRIES = 15; // 15 * 2s = 30s max wait for model load

export class EmbeddedProvider implements ModelProvider {
  readonly providerId = 'embedded';
  readonly providerName = 'Sentinel Embedded AI (llama.cpp)';

  private baseUrl: string;
  private _isHealthy = false;

  constructor(customPort?: number) {
    this.baseUrl = customPort 
      ? `http://localhost:${customPort}` 
      : EMBEDDED_BASE_URL;
  }

  /**
   * Check if the embedded llama-server is running and ready.
   * Uses the /health endpoint which returns 200 when model is loaded.
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      
      const res = await fetch(`${this.baseUrl}/health`, { 
        method: 'GET',
        signal: controller.signal 
      });
      clearTimeout(timeout);
      
      if (res.ok) {
        const data = await res.json().catch(() => ({})) as any;
        // llama-server returns {"status":"ok"} when model is loaded
        this._isHealthy = data?.status === 'ok' || res.status === 200;
        return this._isHealthy;
      }
      return false;
    } catch {
      this._isHealthy = false;
      return false;
    }
  }

  /**
   * Wait for the embedded server to become ready (called during app startup).
   * Returns true when the model is loaded and inference is available.
   */
  public async waitForReady(onProgress?: (status: string) => void): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_HEALTH_RETRIES; attempt++) {
      onProgress?.(`Initializing Sentinel AI... (${attempt + 1}/${MAX_HEALTH_RETRIES})`);
      
      if (await this.isAvailable()) {
        onProgress?.('Sentinel AI ready.');
        return true;
      }
      
      // Wait 2 seconds between health checks
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    onProgress?.('Embedded AI server failed to start. Falling back to Ollama.');
    return false;
  }

  public async listModels(): Promise<ModelMetadata[]> {
    if (!this._isHealthy) {
      await this.isAvailable();
    }
    
    if (!this._isHealthy) return [];

    try {
      // llama-server /v1/models endpoint
      const res = await fetch(`${this.baseUrl}/v1/models`);
      if (!res.ok) {
        // Server is running but may not support /v1/models — return default
        return [{
          id: 'sentinel-embedded',
          name: 'Sentinel Embedded Model',
          sizeBytes: 0,
          quantization: 'Q4_K_M'
        }];
      }
      
      const data = await res.json() as any;
      return (data.data || []).map((m: any) => ({
        id: m.id || 'sentinel-embedded',
        name: m.id || 'Sentinel Embedded Model',
        sizeBytes: 0,
        quantization: 'Q4_K_M'
      }));
    } catch {
      return [{
        id: 'sentinel-embedded',
        name: 'Sentinel Embedded Model',
        sizeBytes: 0,
        quantization: 'Q4_K_M'
      }];
    }
  }

  public async hasModel(_modelId: string): Promise<boolean> {
    // The embedded server always has exactly one model loaded
    return this._isHealthy || await this.isAvailable();
  }

  public async pullModel(_modelId: string, onProgress?: (percent: number, status: string) => void): Promise<boolean> {
    // Embedded models are pre-bundled — no pulling needed
    onProgress?.(100, 'Model is bundled with Sentinel.');
    return true;
  }

  /**
   * Generate text using the embedded llama-server.
   * Uses /v1/chat/completions (OpenAI-compatible) as primary — best for instruct models.
   * Falls back to raw /completion endpoint if chat endpoint fails.
   */
  public async generate(prompt: string, _modelId?: string, options?: GenerateOptions): Promise<ProviderResponse> {
    const startTime = performance.now();

    let messages: { role: string; content: string }[];

    if (options?.messages && options.messages.length > 0) {
      messages = options.messages;
    } else {
      // Split system prompt from user message if present
      const systemSplit = prompt.indexOf('\n\nUser: ');
      
      if (systemSplit > 0) {
        const systemPrompt = prompt.substring(0, systemSplit).trim();
        const conversationPart = prompt.substring(systemSplit).trim();
        
        // Parse User:/Assistant: blocks into proper messages
        messages = [{ role: 'system', content: systemPrompt }];
        const lines = conversationPart.split('\n');
        let currentRole = '';
        let currentContent = '';
        
        for (const line of lines) {
          if (line.startsWith('User: ')) {
            if (currentRole && currentContent) {
              messages.push({ role: currentRole, content: currentContent.trim() });
            }
            currentRole = 'user';
            currentContent = line.substring(6);
          } else if (line.startsWith('Assistant: ')) {
            if (currentRole && currentContent) {
              messages.push({ role: currentRole, content: currentContent.trim() });
            }
            currentRole = 'assistant';
            currentContent = line.substring(11);
          } else if (currentRole) {
            currentContent += '\n' + line;
          }
        }
        if (currentRole && currentContent) {
          messages.push({ role: currentRole, content: currentContent.trim() });
        }
      } else {
        messages = [{ role: 'user', content: prompt }];
      }
    }

    // Primary: OpenAI-compatible chat completions (best for instruct models)
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          max_tokens: options?.maxTokens ?? 256,
          temperature: options?.temperature ?? 0.05,
          top_p: options?.topP ?? 0.9,
          stream: false,
          // Optimizations for speed
          repeat_penalty: 1.1,
          top_k: 20,
          cache_prompt: true,
          ...(options?.logitBias ? { logit_bias: options.logitBias } : {}),
          ...(options?.grammar ? { grammar: options.grammar } : {})
        })
      });

      if (!response.ok) {
        throw new Error(`Chat completion failed: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      const latencyMs = performance.now() - startTime;

      return {
        content,
        raw: data,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        },
        latencyMs
      };
    } catch (chatError) {
      // Fallback: raw /completion endpoint
      try {
        const response = await fetch(`${this.baseUrl}/completion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            n_predict: options?.maxTokens ?? 256,
            temperature: options?.temperature ?? 0.05,
            top_p: options?.topP ?? 0.9,
            stop: ['</s>', '<|im_end|>', '\n\n\n'],
            cache_prompt: true,
            ...(options?.grammar ? { grammar: options.grammar } : {})
          })
        });

        if (!response.ok) {
          throw new Error(`Completion failed: ${response.status}`);
        }

        const data = await response.json() as any;
        const content = data.content || data.text || '';
        const latencyMs = performance.now() - startTime;

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
      } catch (completionError) {
        throw new Error(`[EmbeddedProvider] All inference endpoints failed. Chat: ${chatError}. Completion: ${completionError}`);
      }
    }
  }

  /**
   * Get the base URL for the embedded server.
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if the server is currently healthy (cached, no network call).
   */
  public isHealthy(): boolean {
    return this._isHealthy;
  }
}
