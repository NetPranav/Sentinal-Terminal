import { IntentData } from '../schemas/IntentSchema';

export interface IntentModel {
  classify(prompt: string): Promise<IntentData>;
}
