import { IntentModel } from '../models/IntentModel';
import { IntentData } from '../schemas/IntentSchema';
import { EntityExtractor } from './EntityExtractor';
import { ExtractedEntitiesData } from '../schemas/EntitySchema';

export class IntentRouter {
  constructor(
    private intentModel: IntentModel,
    private entityExtractor: EntityExtractor
  ) {}

  public async route(prompt: string): Promise<{ intent: IntentData, entities: ExtractedEntitiesData }> {
    try {
      const intent = await this.intentModel.classify(prompt);
      const entities = this.entityExtractor.extract(prompt);
      
      return { intent, entities };
    } catch (e) {
      console.warn('Primary classification failed, using fallback.');
      return {
        intent: { domain: 'shell', action: 'execute', confidence: 0.1 },
        entities: this.entityExtractor.extract(prompt)
      };
    }
  }
}
