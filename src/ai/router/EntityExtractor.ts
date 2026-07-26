import { ExtractedEntitiesData } from '../schemas/EntitySchema';
import { EntityMatcher } from '../helpers/EntityMatcher';

export class EntityExtractor {
  public extract(input: string): ExtractedEntitiesData {
    const entities = EntityMatcher.match(input);
    const result: ExtractedEntitiesData = {};
    
    for (const entity of entities) {
      if (!result[entity.type]) {
        result[entity.type] = [];
      }
      result[entity.type].push(entity);
    }
    
    return result;
  }
}
