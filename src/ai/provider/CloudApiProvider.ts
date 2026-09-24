/**
 * CloudApiProvider.ts — Unified Cloud LLM Provider Layer
 * 
 * Implements ModelProvider for commercial and open cloud endpoints:
 * - OpenAI (gpt-4o, gpt-4o-mini, o3-mini)
 * - Anthropic (claude-3-5-sonnet, claude-3-5-haiku)
 * - Groq (llama-3.3-70b-versatile, qwen-2.5-coder-32b) — Ultra-low latency
 * - DeepSeek (deepseek-chat, deepseek-reasoner)
 * - OpenRouter (openrouter/auto)
 * - Custom OpenAI-compatible endpoints (baseUrl + modelId + apiKey)
 * 
 * Features:
 * - Secure local persistence of API keys in localStorage
 * - One-click connection testing with latency measurement
 * - Streaming & non-streaming execution conforming to Sentinel's JSON contract
 */

import { ModelProvider, ModelMetadata, GenerateOptions, ProviderResponse } from './Provider';

export type CloudServiceId = 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter' | 'custom';

export interface CloudKeyConfig {
  serviceId: CloudServiceId;
  apiKey: string;
  baseUrl?: string;
  modelId?: string;
  displayName: string;
  isActive: boolean;
  lastTestedAt?: number;
  lastLatencyMs?: number;
}

export const CLOUD_CATALOG: Record<CloudServiceId, { name: string; defaultUrl: string; defaultModel: string; models: string[] }> = {
  openai: {
    name: 'OpenAI',
    defaultUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini']
  },
  anthropic: {
    name: 'Anthropic',
    defaultUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022']
  },
  groq: {
    name: 'Groq (Ultra-Fast LPUs)',
    defaultUrl: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'qwen-2.5-coder-32b']
  },
  deepseek: {
    name: 'DeepSeek',
    defaultUrl: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  openrouter: {
    name: 'OpenRouter',
    defaultUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'openrouter/auto',
    models: ['openrouter/auto']
  },
  custom: {
    name: 'Custom OpenAI-Compatible',
    defaultUrl: 'http://localhost:8000/v1/chat/completions',
    defaultModel: 'default',
    models: ['default']
  }
};

/**
 * Normalizes user-provided or default URLs into full API endpoint paths.
 * Automatically appends /chat/completions (for OpenAI-compatible endpoints)
 * or /messages (for Anthropic) if the user provides a base URL (e.g. https://integrate.api.nvidia.com/v1).
 */
export function normalizeEndpointUrl(serviceId: CloudServiceId, rawUrl?: string): string {
  const catalog = CLOUD_CATALOG[serviceId];
  let url = (rawUrl || '').trim();
  if (!url) {
    return catalog.defaultUrl;
  }

  // Remove trailing slashes
  url = url.replace(/\/+$/, '');

  if (serviceId === 'anthropic') {
    if (url.endsWith('/messages')) return url;
    return `${url}/messages`;
  }

  // OpenAI-compatible endpoints (openai, groq, deepseek, openrouter, custom/nvidia)
  if (url.endsWith('/chat/completions')) {
    return url;
  }

  if (url.endsWith('/v1')) {
    return `${url}/chat/completions`;
  }

  if (url.includes('nvidia.com')) {
    return `${url}/v1/chat/completions`;
  }

  return `${url}/chat/completions`;
}

/**
 * Universal fetch that routes via Tauri's native reqwest client when available,
 * completely bypassing browser CORS restrictions and WebKit 'Load failed' errors.
 */
export async function httpFetch(url: string, init?: RequestInit): Promise<Response> {
  if (typeof window !== 'undefined' && ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__)) {
    try {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      return await tauriFetch(url, init);
    } catch (err) {
      console.warn('[CloudApiProvider] Tauri HTTP plugin fallback to native fetch:', err);
    }
  }
  return await fetch(url, init);
}

/**
 * Extracts a meaningful error message from varied LLM API responses (OpenAI, Anthropic, NVIDIA, FastAPI).
 */
async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data) {
      if (typeof data.error === 'string') return data.error;
      if (data.error?.message) return data.error.message;
      if (typeof data.detail === 'string') return data.detail;
      if (Array.isArray(data.detail)) return data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      if (data.title && data.detail) return `${data.title}: ${data.detail}`;
      if (data.message) return data.message;
      if (data.title) return data.title;
    }
  } catch {
    const text = await res.text().catch(() => '');
    if (text) return text.slice(0, 200);
  }
  return `HTTP ${res.status}: ${res.statusText || 'Request failed'}`;
}

export class CloudApiProvider implements ModelProvider {
  public readonly providerId = 'cloud_api';
  public readonly providerName = 'Cloud API Provider';

  private static instance: CloudApiProvider;
  private static readonly STORAGE_KEY = 'sentinel_cloud_api_keys';
  private inMemoryConfigs: Record<string, CloudKeyConfig> = {};

  public static getInstance(): CloudApiProvider {
    if (!CloudApiProvider.instance) {
      CloudApiProvider.instance = new CloudApiProvider();
    }
    return CloudApiProvider.instance;
  }

  /**
   * Retrieves all saved key configurations
   */
  public getSavedConfigs(): Record<CloudServiceId, CloudKeyConfig> {
    if (Object.keys(this.inMemoryConfigs).length > 0) {
      return { ...this.inMemoryConfigs } as Record<CloudServiceId, CloudKeyConfig>;
    }

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(CloudApiProvider.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.inMemoryConfigs = parsed;
          return { ...parsed };
        }
      }
    } catch {
      // Fallback
    }

    // Default empty configs
    const defaults: Record<string, CloudKeyConfig> = {};
    for (const [id, meta] of Object.entries(CLOUD_CATALOG)) {
      defaults[id] = {
        serviceId: id as CloudServiceId,
        apiKey: '',
        baseUrl: meta.defaultUrl,
        modelId: meta.defaultModel,
        displayName: meta.name,
        isActive: false
      };
    }
    this.inMemoryConfigs = defaults;
    return { ...defaults } as Record<CloudServiceId, CloudKeyConfig>;
  }

  /**
   * Saves or updates a service configuration
   */
  public saveConfig(config: CloudKeyConfig): void {
    const current = this.getSavedConfigs();
    current[config.serviceId] = config;
    this.inMemoryConfigs = current;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CloudApiProvider.STORAGE_KEY, JSON.stringify(current));
      }
    } catch {
      // Non-fatal
    }
  }

  /**
   * Returns the currently active cloud configuration (if any)
   */
  public getActiveConfig(): CloudKeyConfig | undefined {
    const configs = this.getSavedConfigs();
    return Object.values(configs).find(c => c.isActive && c.apiKey.trim().length > 0);
  }

  /**
   * Tests connection with a lightweight probe request
   */
  public async testConnection(
    serviceId: CloudServiceId,
    apiKey: string,
    customUrl?: string,
    customModel?: string
  ): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
    const url = normalizeEndpointUrl(serviceId, customUrl);
    const model = customModel?.trim() || CLOUD_CATALOG[serviceId].defaultModel;

    const start = performance.now();

    try {
      if (serviceId === 'anthropic') {
        const res = await httpFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model,
            max_tokens: 16,
            messages: [{ role: 'user', content: 'ping' }]
          })
        });

        const latencyMs = Math.round(performance.now() - start);
        if (!res.ok) {
          const errMessage = await extractErrorMessage(res);
          return { success: false, error: errMessage };
        }
        return { success: true, latencyMs };
      }

      // Standard OpenAI-compatible format (OpenAI, Groq, DeepSeek, OpenRouter, NVIDIA, Custom)
      const res = await httpFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });

      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) {
        const errMessage = await extractErrorMessage(res);
        return { success: false, error: errMessage };
      }
      return { success: true, latencyMs };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network connection failed' };
    }
  }

  public async isAvailable(): Promise<boolean> {
    const active = this.getActiveConfig();
    return Boolean(active && active.apiKey);
  }

  public async listModels(): Promise<ModelMetadata[]> {
    const configs = this.getSavedConfigs();
    const result: ModelMetadata[] = [];
    for (const [serviceId, config] of Object.entries(configs)) {
      if (config.apiKey) {
        const catalog = CLOUD_CATALOG[serviceId as CloudServiceId];
        for (const m of catalog.models) {
          result.push({
            id: `${serviceId}:${m}`,
            name: `${catalog.name} — ${m}`,
            sizeBytes: 0,
            parameterCount: 'Cloud API'
          });
        }
      }
    }
    return result;
  }

  public async hasModel(modelId: string): Promise<boolean> {
    const models = await this.listModels();
    return models.some(m => m.id === modelId);
  }

  public async pullModel(_modelId: string): Promise<boolean> {
    // Cloud models do not require local disk downloads
    return true;
  }

  public async generate(prompt: string, modelId?: string, options?: GenerateOptions): Promise<ProviderResponse> {
    const active = this.getActiveConfig();
    if (!active || !active.apiKey) {
      throw new Error('No active Cloud API key configured. Please configure an API key in AI Settings.');
    }

    const start = performance.now();
    const url = normalizeEndpointUrl(active.serviceId, active.baseUrl);
    const model = modelId || active.modelId || CLOUD_CATALOG[active.serviceId].defaultModel;

    // Messages formatting
    const messages = options?.messages || [
      { role: 'system', content: 'You are Sentinel, an autonomous Linux terminal copilot. Always respond with valid JSON.' },
      { role: 'user', content: prompt }
    ];

    if (active.serviceId === 'anthropic') {
      const systemMsg = messages.find(m => m.role === 'system')?.content;
      const nonSystemMessages = messages.filter(m => m.role !== 'system');

      const body: any = {
        model,
        max_tokens: options?.maxTokens || 1024,
        messages: nonSystemMessages
      };
      if (systemMsg) body.system = systemMsg;

      const res = await httpFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': active.apiKey.trim(),
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });

      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) {
        const errMessage = await extractErrorMessage(res);
        throw new Error(errMessage);
      }

      const json = await res.json();
      const content = json.content?.[0]?.text || '';
      return {
        content,
        raw: json,
        usage: {
          promptTokens: json.usage?.input_tokens || 0,
          completionTokens: json.usage?.output_tokens || 0,
          totalTokens: (json.usage?.input_tokens || 0) + (json.usage?.output_tokens || 0)
        },
        latencyMs
      };
    }

    // Standard OpenAI-compatible execution
    const requestBody: any = {
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens || 1024
    };
    if (options?.format === 'json') {
      requestBody.response_format = { type: 'json_object' };
    }

    let res = await httpFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${active.apiKey.trim()}`
      },
      body: JSON.stringify(requestBody)
    });

    // If endpoint rejects response_format (e.g. 400 Bad Request on some models), retry once without it
    if (!res.ok && res.status === 400 && requestBody.response_format) {
      delete requestBody.response_format;
      res = await httpFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${active.apiKey.trim()}`
        },
        body: JSON.stringify(requestBody)
      });
    }

    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) {
      const errMessage = await extractErrorMessage(res);
      throw new Error(errMessage);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';
    return {
      content,
      raw: json,
      usage: {
        promptTokens: json.usage?.prompt_tokens || 0,
        completionTokens: json.usage?.completion_tokens || 0,
        totalTokens: json.usage?.total_tokens || 0
      },
      latencyMs
    };
  }
}
