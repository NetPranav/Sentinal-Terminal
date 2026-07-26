import { EntityData } from '../schemas/EntitySchema';

export class EntityMatcher {
  private static patterns: Record<string, RegExp> = {
    url: /(https?:\/\/[^\s]+)/g,
    email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g,
    ip: /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g,
    port: /(?::|port\s+)(\d{2,5})\b/gi,
    file_path: /(~?\/[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)+|\.\/[a-zA-Z0-9._-]+)/g,
    device_name: /\b(AirPods(?: Pro| Max)?|Magic Mouse|Magic Keyboard|HomePod|JBL|Bose|Sony [a-zA-Z0-9-]+|Nothing Phone(?: [a-zA-Z0-9]+)?)\b/gi,
    git_branch: /\b(?:branch|on)\s+([a-zA-Z0-9._/-]+)/gi,
  };

  public static match(input: string): EntityData[] {
    const results: EntityData[] = [];
    
    for (const [type, regex] of Object.entries(this.patterns)) {
      // Create a new regex instance or reset lastIndex to prevent state leak across calls
      const cleanRegex = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = cleanRegex.exec(input)) !== null) {
        results.push({
          type,
          value: match[1],
          raw: match[0],
          confidence: 0.95
        });
      }
    }

    return results;
  }
}

