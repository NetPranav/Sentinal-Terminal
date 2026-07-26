import { AIResponse as BaseResponse } from '../types/Model';

export class AIResponse implements BaseResponse {
  constructor(
    public content: string,
    public usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }
  ) {}
}
