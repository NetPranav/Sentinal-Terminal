/**
 * ParameterCollector.ts — Interactive prompts for missing runtime parameters
 */

export interface ParameterPrompt {
  readonly parameterName: string;
  readonly type: 'string' | 'number' | 'boolean' | 'path';
  readonly message: string;
  readonly defaultValue?: any;
  readonly required: boolean;
}

export class ParameterCollector {
  public generatePrompts(missingParams: string[]): ParameterPrompt[] {
    return missingParams.map(param => ({
      parameterName: param,
      type: 'string', // Default fallback
      message: `Please provide a value for "${param}":`,
      required: true
    }));
  }
}
