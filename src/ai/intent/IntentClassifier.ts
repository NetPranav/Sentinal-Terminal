/**
 * IntentClassifier.ts — Fast Hybrid Intent & Domain Classification
 * 
 * Determines primary domain, category, and action from unrestricted natural language.
 * Uses ultra-fast heuristic rules (<5ms) for standard OS instructions, and local LLM provider when complex.
 */

import { ModelManager } from '../management/ModelManager';
import { ContextBuilder } from './ContextBuilder';

export interface ClassifiedIntent {
  domain: string;
  category: string;
  action: string;
  confidence: number;
}

export class IntentClassifier {
  constructor(private modelManager: ModelManager, private contextBuilder: ContextBuilder) {}

  public async classify(query: string): Promise<ClassifiedIntent> {
    const clean = query.toLowerCase().trim();

    // 1. Ultra-fast semantic and pattern heuristic matching (<5ms execution)
    if (clean.includes('bluetooth') || clean.includes('bt ')) {
      if (clean.includes('on') || clean.includes('enable') || clean.includes('start') || clean.includes('activate')) {
        return { domain: 'network', category: 'Bluetooth', action: 'on', confidence: 0.99 };
      }
      if (clean.includes('off') || clean.includes('disable') || clean.includes('stop') || clean.includes('deactivate')) {
        return { domain: 'network', category: 'Bluetooth', action: 'off', confidence: 0.99 };
      }
      if (clean.includes('connect') || clean.includes('pair')) {
        return { domain: 'network', category: 'Bluetooth', action: 'connect', confidence: 0.95 };
      }
      return { domain: 'network', category: 'Bluetooth', action: 'list', confidence: 0.98 };
    }

    if (clean.includes('wifi') || clean.includes('wireless') || clean.includes('ssid') || clean.includes('network')) {
      if (clean.includes('scan') || clean.includes('show') || clean.includes('list') || clean.includes('find') || clean.includes('what')) {
        return { domain: 'network', category: 'WiFi', action: 'scan', confidence: 0.98 };
      }
    }

    if (clean.includes('spec') || clean.includes('cpu') || clean.includes('ram') || clean.includes('memory') || clean.includes('system info') || clean.includes('hardware')) {
      return { domain: 'system', category: 'Diagnostics', action: 'info', confidence: 0.97 };
    }

    if (clean.startsWith('ls ') || clean.startsWith('list ') || clean.includes('files in') || clean.includes('show files') || clean.includes('directory')) {
      return { domain: 'filesystem', category: 'Operations', action: 'list', confidence: 0.96 };
    }

    if (clean.startsWith('open ') || clean.startsWith('launch ')) {
      return { domain: 'application', category: 'Desktop', action: 'open', confidence: 0.94 };
    }

    // 2. Fallback to ToolSearcher best matching domain
    const searcher = this.contextBuilder.getToolSearcher();
    const best = searcher.findBestMatch(query);
    if (best && best.score >= 200) {
      const def = best.tool.definition;
      const parts = def.id.split('.');
      const action = parts[parts.length - 1] || 'execute';
      return {
        domain: def.domain,
        category: def.category,
        action: action,
        confidence: Math.min(1.0, best.score / 1000)
      };
    }

    // 3. Default safe classification
    return { domain: 'shell', category: 'Execution', action: 'execute', confidence: 0.50 };
  }
}
