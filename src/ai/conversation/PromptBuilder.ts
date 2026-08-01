/**
 * PromptBuilder.ts — LLM Prompt Templates for Goal & Entity Extraction
 *
 * Builds structured prompts for the local model. Prompts NEVER mention:
 * - Shell commands
 * - Workflows
 * - Tools
 * - Operating systems
 * - Execution strategies
 *
 * Prompts exist ONLY for:
 * - Goal extraction
 * - Entity extraction
 * - Conversation resolution (pronoun, reference)
 */

import type { ConversationMemoryEntry, NormalizedGoal } from './ConversationTypes';

/**
 * Builds optimized prompts for the conversation engine's LLM calls.
 */
export class PromptBuilder {
  /**
   * Build a prompt for extracting the user's high-level goal.
   *
   * Returns a prompt that asks the model to produce:
   * { "goal": "domain.action", "confidence": 0.95, "reasoning": "..." }
   */
  public buildGoalExtractionPrompt(
    userInput: string,
    history?: ConversationMemoryEntry[]
  ): string {
    const historyBlock = history && history.length > 0
      ? this.formatHistory(history)
      : '';

    return `You are a goal understanding system. Your ONLY job is to determine WHAT the user wants — NOT how to do it.

Given the user's natural language input, extract a single high-level goal in "domain.action" format.

DOMAINS: bluetooth, wifi, filesystem, git, docker, application, browser, process, system, package, network, ssh, terminal

EXAMPLE GOALS:
- "Turn bluetooth on" → bluetooth.enable
- "Open Chrome" → application.open
- "Clone my repository" → git.clone
- "Find my Downloads folder" → filesystem.locate_folder
- "Kill the process using port 3000" → process.kill_by_port
- "Connect to my AirPods" → bluetooth.connect
- "List all running containers" → docker.list
- "Push my changes" → git.push
- "What's using port 8080" → process.find_by_port
- "Install express" → package.install

RULES:
1. The goal is NOT a command. It is a semantic description of intent.
2. The goal is NOT platform dependent.
3. Output ONLY valid JSON. No explanations, no markdown.
4. If you are unsure, set confidence below 0.5.
5. Do NOT invent domains not listed above.

OUTPUT FORMAT (strict JSON):
{
  "goal": "domain.action",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this goal was chosen"
}
${historyBlock}
USER INPUT: "${userInput}"

Respond with ONLY the JSON object:`;
  }

  /**
   * Build a prompt for extracting entities from user input.
   *
   * Returns a prompt that asks the model to produce:
   * { "entities": [{ "type": "...", "value": "...", "confidence": 0.99 }] }
   */
  public buildEntityExtractionPrompt(
    userInput: string,
    goalHint?: NormalizedGoal
  ): string {
    const goalContext = goalHint
      ? `\nThe detected goal is: "${goalHint}". Extract entities relevant to this goal.`
      : '';

    return `You are an entity extraction system. Extract all relevant parameters from the user's input.

ENTITY TYPES: application, port, file, folder, path, url, repository, branch, ssid, bluetooth_device, container, docker_image, package, process, ip_address, email, user, ssh_host, workspace, python_env, device_name

EXAMPLES:
- "Open Chrome" → [{ "type": "application", "value": "Chrome", "confidence": 0.99 }]
- "Kill port 3000" → [{ "type": "port", "value": "3000", "confidence": 0.99 }]
- "Clone github.com/user/repo" → [{ "type": "repository", "value": "user/repo", "confidence": 0.99 }]
- "Connect to MyWiFi" → [{ "type": "ssid", "value": "MyWiFi", "confidence": 0.95 }]
- "SSH into prod-server" → [{ "type": "ssh_host", "value": "prod-server", "confidence": 0.95 }]

RULES:
1. Extract every useful parameter. Do not skip entities.
2. Each entity must have type, value, and confidence.
3. Output ONLY valid JSON. No explanations, no markdown.
4. Confidence must be between 0.0 and 1.0.
${goalContext}

OUTPUT FORMAT (strict JSON):
{
  "entities": [
    { "type": "entity_type", "value": "extracted_value", "confidence": 0.95 }
  ]
}

USER INPUT: "${userInput}"

Respond with ONLY the JSON object:`;
  }

  /**
   * Build a prompt for resolving pronouns and references in follow-up queries.
   *
   * Returns a prompt that asks the model to produce:
   * { "resolved": "full query with pronouns replaced", "references": [...] }
   */
  public buildConversationResolutionPrompt(
    userInput: string,
    history: ConversationMemoryEntry[]
  ): string {
    const historyBlock = this.formatHistory(history);

    return `You are a reference resolution system. Resolve pronouns and references in the user's follow-up message based on conversation history.

EXAMPLES:
- History: "Open Chrome" → Follow-up: "Now close it" → Resolved: "Close Chrome"
- History: "Find my Downloads folder" → Follow-up: "Delete everything in there" → Resolved: "Delete everything in Downloads folder"
- History: "Connect to AirPods" → Follow-up: "Disconnect them" → Resolved: "Disconnect AirPods"

RULES:
1. Replace "it", "that", "this", "them", "there", "the file", "the app", etc. with their referents.
2. If no pronoun resolution is needed, return the original input unchanged.
3. Output ONLY valid JSON. No explanations.

OUTPUT FORMAT (strict JSON):
{
  "resolved": "the full query with all pronouns and references resolved",
  "references": [
    { "pronoun": "it", "resolved_to": "Chrome" }
  ]
}
${historyBlock}
USER INPUT: "${userInput}"

Respond with ONLY the JSON object:`;
  }

  /**
   * Validate that no prompt contains shell command references.
   * Used in testing to enforce prompt safety.
   */
  public static validatePromptSafety(prompt: string): { safe: boolean; violations: string[] } {
    const violations: string[] = [];
    const forbidden = [
      /\bsudo\b/i,
      /\bbash\b/i,
      /\bpowershell\b/i,
      /\bexec\b/i,
      /\bshell\s+command/i,
      /\brun\s+command/i,
      /\bexecute\s+command/i,
      /\bcommand\s+line/i,
      /\bterminal\s+command/i,
      /\bscript/i,
    ];

    for (const pattern of forbidden) {
      if (pattern.test(prompt)) {
        violations.push(`Contains forbidden pattern: ${pattern.source}`);
      }
    }

    return { safe: violations.length === 0, violations };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private formatHistory(history: ConversationMemoryEntry[]): string {
    if (history.length === 0) return '';

    const lines = history.slice(-5).map((entry, i) => {
      const entityStr = entry.entities.length > 0
        ? ` [entities: ${entry.entities.map(e => `${e.type}=${e.value}`).join(', ')}]`
        : '';
      return `  Turn ${i + 1}: "${entry.query}" → goal: ${entry.goal.id}${entityStr}`;
    });

    return `\nCONVERSATION HISTORY:\n${lines.join('\n')}\n`;
  }
}
