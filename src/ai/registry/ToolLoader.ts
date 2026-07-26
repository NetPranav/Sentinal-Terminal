import { ToolSchema } from '../schemas/ToolSchema';
import { ToolRegistry } from './ToolRegistry';

export class ToolLoader {
  constructor(private registry: ToolRegistry) {}

  public loadFromJson(jsonString: string): void {
    try {
      const parsed = JSON.parse(jsonString);
      // Validate
      const validated = ToolSchema.parse(parsed);
      this.registry.register(validated);
    } catch (e) {
      console.error('Failed to load tool from JSON', e);
      throw e;
    }
  }

  public loadMany(jsonArray: any[]): void {
    for (const item of jsonArray) {
      try {
        const validated = ToolSchema.parse(item);
        this.registry.register(validated);
      } catch (e) {
        console.warn('Skipping invalid tool', item, e);
      }
    }
  }
}
