/**
 * IntentNormalizer.ts — Synonym → Canonical Goal Mapping
 *
 * Maps the many natural-language ways users express the same intent
 * into a single canonical NormalizedGoal string (domain.action).
 *
 * Implemented as prioritized pattern rules. Platform-independent —
 * no OS-specific normalization.
 *
 * This is the fastest path through the conversation engine (<1ms).
 */

import type { NormalizedGoal, GoalDomain } from './ConversationTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Normalization Rule
// ─────────────────────────────────────────────────────────────────────────────

interface NormalizationRule {
  /** Pattern to match against lowercased user input */
  pattern: RegExp;
  /** The canonical goal this maps to */
  goal: NormalizedGoal;
  /** Domain for quick lookups */
  domain: GoalDomain;
  /** Minimum confidence for this pattern match */
  confidence: number;
}

/**
 * Result of intent normalization.
 */
export interface NormalizationResult {
  /** The canonical goal, or null if no pattern matched */
  goal: NormalizedGoal | null;
  /** Domain, or null if no match */
  domain: GoalDomain | null;
  /** Confidence of the normalization (0.0 - 1.0) */
  confidence: number;
  /** Whether a pattern matched */
  matched: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalizer
// ─────────────────────────────────────────────────────────────────────────────

export class IntentNormalizer {
  private rules: NormalizationRule[];

  constructor() {
    this.rules = IntentNormalizer.buildRules();
  }

  /**
   * Attempt to normalize a user input string into a canonical goal.
   * Returns immediately — no LLM calls, pure pattern matching.
   */
  public normalize(input: string): NormalizationResult {
    const clean = input.toLowerCase().trim();

    if (!clean) {
      return { goal: null, domain: null, confidence: 0, matched: false };
    }

    for (const rule of this.rules) {
      if (rule.pattern.test(clean)) {
        return {
          goal: rule.goal,
          domain: rule.domain,
          confidence: rule.confidence,
          matched: true,
        };
      }
    }

    return { goal: null, domain: null, confidence: 0, matched: false };
  }

  /**
   * Get all known canonical goals for documentation / debugging.
   */
  public getCanonicalGoals(): NormalizedGoal[] {
    const seen = new Set<NormalizedGoal>();
    for (const rule of this.rules) {
      seen.add(rule.goal);
    }
    return Array.from(seen);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rule Definitions
  // ─────────────────────────────────────────────────────────────────────────

  private static buildRules(): NormalizationRule[] {
    return [
      // ── Bluetooth ──────────────────────────────────────────────────────
      {
        pattern: /\b(?:turn\s+on|enable|activate|switch\s+on|power\s+on|start)\s+(?:the\s+)?bluetooth\b/,
        goal: 'bluetooth.enable' as NormalizedGoal,
        domain: 'bluetooth',
        confidence: 0.98,
      },
      {
        pattern: /\bbluetooth\s+(?:on|enable|activate|start)\b/,
        goal: 'bluetooth.enable' as NormalizedGoal,
        domain: 'bluetooth',
        confidence: 0.97,
      },
      {
        pattern: /\b(?:turn\s+off|disable|deactivate|switch\s+off|power\s+off|stop)\s+(?:the\s+)?bluetooth\b/,
        goal: 'bluetooth.disable' as NormalizedGoal,
        domain: 'bluetooth',
        confidence: 0.98,
      },
      {
        pattern: /\bbluetooth\s+(?:off|disable|deactivate|stop)\b/,
        goal: 'bluetooth.disable' as NormalizedGoal,
        domain: 'bluetooth',
        confidence: 0.97,
      },
      {
        pattern: /\b(?:connect|pair)\s+(?:to\s+|with\s+)?(?:my\s+|the\s+)?(?:bluetooth|bt)\b/,
        goal: 'bluetooth.connect' as NormalizedGoal,
        domain: 'bluetooth',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:connect|pair)\s+(?:to\s+|with\s+)?(?:my\s+|the\s+)?(?:headphones|airpods|earbuds|speaker|mouse|keyboard)/,
        goal: 'bluetooth.connect' as NormalizedGoal,
        domain: 'bluetooth',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:disconnect|unpair)\s+(?:from\s+)?(?:my\s+|the\s+)?(?:bluetooth|bt|headphones|airpods|earbuds|speaker|mouse|keyboard)/,
        goal: 'bluetooth.disconnect' as NormalizedGoal,
        domain: 'bluetooth',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:list|show|scan|find)\s+(?:all\s+)?(?:bluetooth|bt)\s*(?:devices?)?\b/,
        goal: 'bluetooth.list' as NormalizedGoal,
        domain: 'bluetooth',
        confidence: 0.96,
      },

      // ── WiFi ───────────────────────────────────────────────────────────
      {
        pattern: /\b(?:turn\s+on|enable|activate|switch\s+on|start)\s+(?:the\s+)?(?:wifi|wi-fi|wireless)\b/,
        goal: 'wifi.enable' as NormalizedGoal,
        domain: 'wifi',
        confidence: 0.98,
      },
      {
        pattern: /\b(?:wifi|wi-fi|wireless)\s+(?:on|enable)\b/,
        goal: 'wifi.enable' as NormalizedGoal,
        domain: 'wifi',
        confidence: 0.97,
      },
      {
        pattern: /\b(?:turn\s+off|disable|deactivate|switch\s+off|stop)\s+(?:the\s+)?(?:wifi|wi-fi|wireless)\b/,
        goal: 'wifi.disable' as NormalizedGoal,
        domain: 'wifi',
        confidence: 0.98,
      },
      {
        pattern: /\b(?:wifi|wi-fi|wireless)\s+(?:off|disable)\b/,
        goal: 'wifi.disable' as NormalizedGoal,
        domain: 'wifi',
        confidence: 0.97,
      },
      {
        pattern: /\b(?:connect|join)\s+(?:to\s+)?(?:the\s+|my\s+)?(?:wifi|wi-fi|wireless|network|hotspot)\b/,
        goal: 'wifi.connect' as NormalizedGoal,
        domain: 'wifi',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:disconnect)\s+(?:from\s+)?(?:the\s+|my\s+)?(?:wifi|wi-fi|wireless|network)\b/,
        goal: 'wifi.disconnect' as NormalizedGoal,
        domain: 'wifi',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:scan|list|show|find)\s+(?:all\s+)?(?:available\s+)?(?:wifi|wi-fi|wireless)\s*(?:networks?)?\b/,
        goal: 'wifi.scan' as NormalizedGoal,
        domain: 'wifi',
        confidence: 0.96,
      },

      // ── Process ────────────────────────────────────────────────────────
      {
        pattern: /\b(?:kill|terminate|stop|end)\s+(?:the\s+)?process\s+(?:using|on|at|listening\s+on)\s+port\b/,
        goal: 'process.kill_by_port' as NormalizedGoal,
        domain: 'process',
        confidence: 0.97,
      },
      {
        pattern: /\b(?:free|release|clear)\s+(?:the\s+)?port\b/,
        goal: 'process.kill_by_port' as NormalizedGoal,
        domain: 'process',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:kill|terminate|stop|end)\s+(?:the\s+|all\s+)?process/,
        goal: 'process.kill' as NormalizedGoal,
        domain: 'process',
        confidence: 0.94,
      },
      {
        pattern: /\b(?:list|show|find)\s+(?:all\s+)?(?:running\s+)?processes\b/,
        goal: 'process.list' as NormalizedGoal,
        domain: 'process',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:what(?:'s|\s+is)\s+(?:using|on|listening\s+on))\s+port\b/,
        goal: 'process.find_by_port' as NormalizedGoal,
        domain: 'process',
        confidence: 0.96,
      },

      // ── Application ────────────────────────────────────────────────────
      {
        pattern: /\b(?:open|launch|start|run)\s+(?:the\s+|my\s+)?(?:app(?:lication)?\s+)?(\w+)/,
        goal: 'application.open' as NormalizedGoal,
        domain: 'application',
        confidence: 0.92,
      },
      {
        pattern: /\b(?:close|quit|exit|kill|terminate|force\s+quit)\s+(?:the\s+|my\s+)?(?:app(?:lication)?\s+)?(\w+)/,
        goal: 'application.close' as NormalizedGoal,
        domain: 'application',
        confidence: 0.92,
      },
      {
        pattern: /\b(?:list|show)\s+(?:all\s+)?(?:running|open|active)\s+(?:apps?|applications?|programs?)\b/,
        goal: 'application.list' as NormalizedGoal,
        domain: 'application',
        confidence: 0.95,
      },

      // ── Filesystem ─────────────────────────────────────────────────────
      {
        pattern: /\b(?:create|make|new)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:folder|directory|dir)\b/,
        goal: 'filesystem.create_folder' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.96,
      },
      {
        pattern: /\b(?:create|make|new|touch)\s+(?:a\s+|an\s+)?(?:new\s+)?file\b/,
        goal: 'filesystem.create_file' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.96,
      },
      {
        pattern: /\b(?:delete|remove|rm|erase|trash)\s+(?:the\s+|my\s+)?(?:folder|directory|dir)\b/,
        goal: 'filesystem.delete_folder' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.96,
      },
      {
        pattern: /\b(?:delete|remove|rm|erase|trash)\s+(?:the\s+|my\s+)?file\b/,
        goal: 'filesystem.delete_file' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.96,
      },
      {
        pattern: /\b(?:copy|cp|duplicate)\s+(?:the\s+|my\s+)?(?:file|folder|directory)\b/,
        goal: 'filesystem.copy' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:move|mv|rename)\s+(?:the\s+|my\s+)?(?:file|folder|directory)\b/,
        goal: 'filesystem.move' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:rename)\s+/,
        goal: 'filesystem.rename' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.90,
      },
      {
        pattern: /\b(?:list|ls|show|display)\s+(?:the\s+)?(?:files?|contents?|items?)\s+(?:in|of|inside)\b/,
        goal: 'filesystem.list' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:find|locate|search(?: for)?|where)\s+(?:is\s+|are\s+)?(?:the\s+|my\s+)?(?:file|folder|directory|downloads?|desktop|documents?)\b/,
        goal: 'filesystem.locate' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.93,
      },
      {
        pattern: /\b(?:find|locate|search\s+for|where\s+is)\s+(?:my\s+)?(\w+)\s+(?:folder|directory)\b/,
        goal: 'filesystem.locate_folder' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.93,
      },
      {
        pattern: /\b(?:read|cat|view|show|display)\s+(?:the\s+)?(?:contents?\s+of\s+)?(?:the\s+)?(?:file)\b/,
        goal: 'filesystem.read' as NormalizedGoal,
        domain: 'filesystem',
        confidence: 0.94,
      },

      // ── Git ────────────────────────────────────────────────────────────
      {
        pattern: /\b(?:git\s+)?clone\b/,
        goal: 'git.clone' as NormalizedGoal,
        domain: 'git',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:download|clone)\s+(?:the\s+|my\s+)?(?:repo(?:sitory)?)\b/,
        goal: 'git.clone' as NormalizedGoal,
        domain: 'git',
        confidence: 0.94,
      },
      {
        pattern: /\b(?:git\s+)?pull\b/,
        goal: 'git.pull' as NormalizedGoal,
        domain: 'git',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:git\s+)?push\b/,
        goal: 'git.push' as NormalizedGoal,
        domain: 'git',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:git\s+)?commit\b/,
        goal: 'git.commit' as NormalizedGoal,
        domain: 'git',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:git\s+)?(?:checkout|switch\s+to)\s+(?:branch\s+)?/,
        goal: 'git.checkout' as NormalizedGoal,
        domain: 'git',
        confidence: 0.93,
      },
      {
        pattern: /\b(?:git\s+)?(?:create|make|new)\s+(?:a\s+)?branch\b/,
        goal: 'git.create_branch' as NormalizedGoal,
        domain: 'git',
        confidence: 0.94,
      },
      {
        pattern: /\b(?:git\s+)?status\b/,
        goal: 'git.status' as NormalizedGoal,
        domain: 'git',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:git\s+)?(?:log|history)\b/,
        goal: 'git.log' as NormalizedGoal,
        domain: 'git',
        confidence: 0.94,
      },
      {
        pattern: /\b(?:git\s+)?stash\b/,
        goal: 'git.stash' as NormalizedGoal,
        domain: 'git',
        confidence: 0.95,
      },

      // ── Docker ─────────────────────────────────────────────────────────
      {
        pattern: /\b(?:docker\s+)?(?:start|run)\s+(?:the\s+|a\s+)?container\b/,
        goal: 'docker.start' as NormalizedGoal,
        domain: 'docker',
        confidence: 0.94,
      },
      {
        pattern: /\b(?:docker\s+)?stop\s+(?:the\s+|a\s+)?container\b/,
        goal: 'docker.stop' as NormalizedGoal,
        domain: 'docker',
        confidence: 0.94,
      },
      {
        pattern: /\b(?:docker\s+)?(?:list|show|ps)\s+(?:all\s+)?containers?\b/,
        goal: 'docker.list' as NormalizedGoal,
        domain: 'docker',
        confidence: 0.95,
      },
      {
        pattern: /\bdocker\s+(?:build)\b/,
        goal: 'docker.build' as NormalizedGoal,
        domain: 'docker',
        confidence: 0.95,
      },
      {
        pattern: /\bdocker\s+(?:pull)\b/,
        goal: 'docker.pull' as NormalizedGoal,
        domain: 'docker',
        confidence: 0.95,
      },


      // ── Browser ────────────────────────────────────────────────────────
      {
        pattern: /\b(?:open|go\s+to|navigate\s+to|visit|browse)\s+(?:the\s+)?(?:url|website|page|site)?\s*(?:https?:\/\/|www\.)/,
        goal: 'browser.navigate' as NormalizedGoal,
        domain: 'browser',
        confidence: 0.96,
      },
      {
        pattern: /\b(?:open|go\s+to|navigate\s+to|visit)\s+localhost\b/,
        goal: 'browser.navigate' as NormalizedGoal,
        domain: 'browser',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:search|google|look\s+up)\s+(?:for\s+)?/,
        goal: 'browser.search' as NormalizedGoal,
        domain: 'browser',
        confidence: 0.88,
      },

      // ── System ─────────────────────────────────────────────────────────
      {
        pattern: /\b(?:system|hardware|machine)\s+(?:info|specs?|specifications?|details?)\b/,
        goal: 'system.info' as NormalizedGoal,
        domain: 'system',
        confidence: 0.96,
      },
      {
        pattern: /\b(?:what(?:'s|\s+is)\s+my\s+)?(?:cpu|ram|memory|disk|storage|battery|gpu)\b/,
        goal: 'system.info' as NormalizedGoal,
        domain: 'system',
        confidence: 0.93,
      },
      {
        pattern: /\b(?:lock|sleep|shutdown|restart|reboot)\s+(?:the\s+)?(?:computer|machine|system|mac|pc)?\b/,
        goal: 'system.power' as NormalizedGoal,
        domain: 'system',
        confidence: 0.92,
      },
      {
        pattern: /\b(?:change|set|adjust|increase|decrease|lower|raise)\s+(?:the\s+)?(?:volume|brightness|display)\b/,
        goal: 'system.settings' as NormalizedGoal,
        domain: 'system',
        confidence: 0.91,
      },

      // ── Package ────────────────────────────────────────────────────────
      {
        pattern: /\b(?:install)\s+(?:the\s+)?(?:package\s+)?/,
        goal: 'package.install' as NormalizedGoal,
        domain: 'package',
        confidence: 0.88,
      },
      {
        pattern: /\b(?:uninstall|remove)\s+(?:the\s+)?(?:package\s+)?/,
        goal: 'package.uninstall' as NormalizedGoal,
        domain: 'package',
        confidence: 0.88,
      },
      {
        pattern: /\b(?:update|upgrade)\s+(?:all\s+)?(?:packages?|deps?|dependencies)?\b/,
        goal: 'package.update' as NormalizedGoal,
        domain: 'package',
        confidence: 0.87,
      },

      // ── SSH ────────────────────────────────────────────────────────────
      {
        pattern: /\bssh\s+(?:into|to|connect)\b/,
        goal: 'ssh.connect' as NormalizedGoal,
        domain: 'ssh',
        confidence: 0.95,
      },

      // ── Network (general) ──────────────────────────────────────────────
      {
        pattern: /\b(?:ping)\s+/,
        goal: 'network.ping' as NormalizedGoal,
        domain: 'network',
        confidence: 0.95,
      },
      {
        pattern: /\b(?:check|test)\s+(?:my\s+)?(?:internet|connection|connectivity)\b/,
        goal: 'network.check' as NormalizedGoal,
        domain: 'network',
        confidence: 0.93,
      },
    ];
  }
}
