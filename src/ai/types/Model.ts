export interface ModelConfig {
  temperature: number;
  top_p: number;
  top_k?: number;
  max_tokens?: number;
  stop?: string[];
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
