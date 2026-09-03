/**
 * CompositePatterns.ts — Multi-Step Intent Pattern Library
 * 
 * Recognizes common multi-step user instructions that should be decomposed
 * into sequential tool chains. These patterns catch compound instructions
 * that clause-splitting alone can't handle because they're expressed as
 * a single conceptual action.
 * 
 * Examples:
 * - "clone this repo and open in vscode" → git.clone → developer.vscode
 * - "backup my project to desktop" → filesystem.copy (recursive)
 * - "install deps and start dev server" → shell.execute (npm install) → shell.execute (npm run dev)
 */

export interface CompositePattern {
  /** Human-readable name for this pattern */
  name: string;
  /** Regex to match the user's composite instruction */
  pattern: RegExp;
  /** Ordered list of tool IDs to execute sequentially */
  tools: string[];
  /** How to extract entities from the regex capture groups */
  entityExtractor: (match: RegExpMatchArray, fullQuery: string) => Record<string, any>[];
  /** Optional: minimum confidence threshold for this pattern */
  minConfidence?: number;
}

export const CompositePatterns: CompositePattern[] = [
  // --- Git workflows ---
  {
    name: 'Clone & Open',
    pattern: /\b(?:clone|pull|git\s+clone)\b.*?\b(?:and|then|,)\s*(?:open|launch)\s*(?:it\s+)?(?:in\s+)?(?:vs\s*code|vscode|code|editor)/i,
    tools: ['git.clone', 'developer.vscode'],
    entityExtractor: (match, query) => {
      const urlMatch = query.match(/(https?:\/\/\S+|git@\S+)/);
      return [
        { url: urlMatch?.[1] || '', operation: 'clone' },
        { path: '.', operation: 'open' }
      ];
    }
  },
  {
    name: 'Clone & Install',
    pattern: /\b(?:clone|pull)\b.*?\b(?:and|then|,)\s*(?:install|setup|npm\s+install|yarn|pnpm)/i,
    tools: ['git.clone', 'shell.execute'],
    entityExtractor: (match, query) => {
      const urlMatch = query.match(/(https?:\/\/\S+|git@\S+)/);
      return [
        { url: urlMatch?.[1] || '', operation: 'clone' },
        { command: 'npm install', operation: 'execute' }
      ];
    }
  },

  // --- Development workflows ---
  {
    name: 'Install & Run Dev',
    pattern: /\b(?:install|setup)\s+(?:dep(?:endenc(?:ies|y))?|packages?|node.?modules?)\b.*?\b(?:and|then|,)\s*(?:start|run|launch)\s+(?:the\s+)?(?:dev|development)?\s*(?:server)?/i,
    tools: ['shell.execute', 'shell.execute'],
    entityExtractor: () => [
      { command: 'npm install', operation: 'execute' },
      { command: 'npm run dev', operation: 'execute' }
    ]
  },
  {
    name: 'Build & Deploy',
    pattern: /\b(?:build)\b.*?\b(?:and|then|,)\s*(?:deploy|push|publish|ship)/i,
    tools: ['shell.execute', 'shell.execute'],
    entityExtractor: () => [
      { command: 'npm run build', operation: 'execute' },
      { command: 'npm run deploy', operation: 'execute' }
    ]
  },

  // --- File management workflows ---
  {
    name: 'Backup to Location',
    pattern: /\b(?:backup|back\s+up|copy)\s+(?:my\s+)?(\w[\w\s]*?)\s+(?:to|into|onto)\s+(\w[\w\s]*?)$/i,
    tools: ['filesystem.copy'],
    entityExtractor: (match, query) => {
      const sourceMatch = query.match(/(?:backup|back\s+up|copy)\s+(?:my\s+)?(.+?)\s+(?:to|into|onto)/i);
      const destMatch = query.match(/(?:to|into|onto)\s+(.+)$/i);
      return [{
        source: sourceMatch?.[1]?.trim() || '.',
        destination: destMatch?.[1]?.trim() || '~/Desktop',
        recursive: true,
        operation: 'copy'
      }];
    }
  },
  {
    name: 'Create Folder & Files',
    pattern: /\b(?:create|make|new)\s+(?:a\s+)?(?:folder|dir(?:ectory)?)\s+(?:called\s+|named\s+)?(\S+).*?\b(?:and|then|,)\s*(?:create|make|add|put)\s+(?:a\s+)?(?:file)/i,
    tools: ['filesystem.mkdir', 'filesystem.create'],
    entityExtractor: (match, query) => {
      const folderMatch = query.match(/(?:folder|dir(?:ectory)?)\s+(?:called\s+|named\s+)?(\S+)/i);
      const fileMatch = query.match(/(?:file)\s+(?:called\s+|named\s+)?(\S+)/i);
      return [
        { name: folderMatch?.[1] || 'new-folder', operation: 'mkdir' },
        { name: fileMatch?.[1] || 'untitled.txt', path: folderMatch?.[1] || '.', operation: 'create' }
      ];
    }
  },

  // --- Network workflows ---
  {
    name: 'Enable & Connect WiFi',
    pattern: /\b(?:turn\s+(?:the\s+)?wifi\s+on|turn\s+on\s+(?:the\s+)?wifi|enable\s+(?:the\s+)?wifi|activate\s+(?:the\s+)?wifi)\b.*?\b(?:and|then|,)\s*(?:connect|join)\s+(?:to\s+)?(.+)/i,
    tools: ['network.wifi.on', 'network.wifi.connect'],
    entityExtractor: (match, query) => {
      const ssidMatch = query.match(/(?:connect|join)\s+(?:to\s+)?(.+)/i);
      return [
        { operation: 'on' },
        { ssid: ssidMatch?.[1]?.trim() || '', operation: 'connect' }
      ];
    }
  },
  {
    name: 'Enable & Connect Bluetooth',
    pattern: /\b(?:turn\s+(?:the\s+)?bluetooth\s+on|turn\s+on\s+(?:the\s+)?bluetooth|enable\s+(?:the\s+)?bluetooth|activate\s+(?:the\s+)?bluetooth)\b.*?\b(?:and|then|,)\s*(?:connect|pair)\s+(?:to\s+|my\s+)?(.+)/i,
    tools: ['network.bluetooth.on', 'network.bluetooth.connect'],
    entityExtractor: (match, query) => {
      const deviceMatch = query.match(/(?:connect|pair)\s+(?:to\s+|my\s+)?(.+)/i);
      const rawDevice = deviceMatch?.[1]?.trim() || '';
      return [
        { operation: 'on' },
        { device: rawDevice.replace(/[.!?]+$/, ''), operation: 'connect' }
      ];
    }
  },

  // --- System workflows ---
  {
    name: 'Find & Kill Process',
    pattern: /\b(?:find|show|list)\s+(?:all\s+)?(?:running\s+)?(?:process(?:es)?|tasks?)\b.*?\b(?:and|then|,)\s*(?:kill|stop|end|terminate)\s+(.+)/i,
    tools: ['system.processes', 'system.kill_process'],
    entityExtractor: (match, query) => {
      const procMatch = query.match(/(?:kill|stop|end|terminate)\s+(.+)/i);
      return [
        { operation: 'list' },
        { process: procMatch?.[1]?.trim() || '', operation: 'kill' }
      ];
    }
  },
  {
    name: 'Kill Port Process',
    pattern: /\b(?:kill|stop|terminate|end|close)\s+(?:all\s+)?(?:the\s+)?(?:ports?)\b(?:.*?)\b(?:used\s+by|running|on|of)?\s+(.+)/i,
    tools: ['system.kill_process'],
    entityExtractor: (match, query) => {
      let target = match[1] || '';
      target = target.replace(/^(?:that\s+is\s+|which\s+is\s+|used\s+by\s+|running\s+on\s+|on\s+|of\s+|by\s+)+/i, '').trim();
      const isNumeric = /^\d+$/.test(target);
      return [
        { process: isNumeric ? `port ${target}` : target, operation: 'kill' }
      ];
    }
  },
];

/**
 * Try to match a query against all composite patterns.
 * Returns the first matching pattern and its extracted entity arrays, or null.
 */
export function matchCompositePattern(query: string): { pattern: CompositePattern; entities: Record<string, any>[] } | null {
  for (const cp of CompositePatterns) {
    const match = query.match(cp.pattern);
    if (match) {
      const entities = cp.entityExtractor(match, query);
      return { pattern: cp, entities };
    }
  }
  return null;
}
