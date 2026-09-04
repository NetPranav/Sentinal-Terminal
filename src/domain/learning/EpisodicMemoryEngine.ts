/**
 * Sentinel Terminal — Tier 3: Episodic Memory Engine
 *
 * Implements Continuous On-Device Learning via:
 * 1. 0ms Dynamic In-Context Retrieval: Stores verified terminal executions & human demonstrations,
 *    indexes them, and injects the top matching workflows directly into the LLM system prompt.
 * 2. Continuous LoRA Fine-Tuning Pipeline: Automatically formats and appends verified
 *    interactions to ~/.sentinel/training/sentinel_shell_dataset.jsonl in ShareGPT format.
 */

import { invoke } from '@tauri-apps/api/core';
import { safeBase64Encode } from '../../utils/encodingUtils';

export interface EpisodicMemory {
  id: string;
  goal: string;
  command: string;
  explanation?: string;
  cwd?: string;
  os?: string;
  timestamp: number;
  source: 'demonstration' | 'verified_execution' | 'explicit_teach';
  confidence: number;
  timesRetrieved: number;
}

export class EpisodicMemoryEngine {
  private static instance: EpisodicMemoryEngine;
  private memories: Map<string, EpisodicMemory> = new Map();
  private isLoaded: boolean = false;

  public static getInstance(): EpisodicMemoryEngine {
    if (!EpisodicMemoryEngine.instance) {
      EpisodicMemoryEngine.instance = new EpisodicMemoryEngine();
    }
    return EpisodicMemoryEngine.instance;
  }

  constructor() {
    this.loadMemories();
  }

  /**
   * Records a user demonstration or successful command execution into episodic memory.
   */
  public recordMemory(
    goal: string,
    command: string,
    options?: {
      explanation?: string;
      cwd?: string;
      os?: string;
      source?: 'demonstration' | 'verified_execution' | 'explicit_teach';
    }
  ): EpisodicMemory {
    const cleanGoal = goal.trim();
    const cleanCmd = command.trim();

    // Check if an existing memory for this goal already exists
    for (const mem of this.memories.values()) {
      if (mem.goal.toLowerCase() === cleanGoal.toLowerCase()) {
        mem.command = cleanCmd;
        mem.explanation = options?.explanation || mem.explanation;
        mem.timestamp = Date.now();
        mem.confidence = Math.min(1.0, mem.confidence + 0.1);
        this.saveMemories();
        this.appendTrainingSampleFromMemory(mem);
        return mem;
      }
    }

    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMemory: EpisodicMemory = {
      id,
      goal: cleanGoal,
      command: cleanCmd,
      explanation: options?.explanation || `Execute command: ${cleanCmd}`,
      cwd: options?.cwd,
      os: options?.os || (typeof process !== 'undefined' ? process.platform : 'darwin'),
      timestamp: Date.now(),
      source: options?.source || 'demonstration',
      confidence: 1.0,
      timesRetrieved: 0
    };

    this.memories.set(id, newMemory);
    this.saveMemories();
    this.appendTrainingSampleFromMemory(newMemory);
    return newMemory;
  }

  /**
   * Retrieves top-K most semantically similar episodic memories for a given user goal.
   */
  public retrieveSimilar(query: string, topK: number = 3, minScore: number = 0.1): EpisodicMemory[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.size === 0) return [];

    const scored: { memory: EpisodicMemory; score: number }[] = [];

    for (const memory of this.memories.values()) {
      const memTokens = this.tokenize(memory.goal);
      const score = this.calculateSimilarity(queryTokens, memTokens, query, memory.goal);
      if (score >= minScore) {
        scored.push({ memory, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, topK).map(s => {
      s.memory.timesRetrieved++;
      return s.memory;
    });

    if (results.length > 0) {
      this.saveMemories();
    }

    return results;
  }

  /**
   * Formats retrieved episodic memories into few-shot guidance for SystemPrompt.ts.
   */
  public formatPromptFewShots(memories: EpisodicMemory[]): string {
    if (!memories || memories.length === 0) return '';

    const lines: string[] = [
      '# User Demonstrated Workflows & Learned Patterns:',
      'Condition your command generation on these verified patterns previously demonstrated on this system:'
    ];

    for (const mem of memories) {
      lines.push(
        `User: "${mem.goal}"`,
        `Response: {"action": "execute", "command": "${mem.command.replace(/"/g, '\\"')}", "explanation": "${(mem.explanation || '').replace(/"/g, '\\"')}"}`,
        ''
      );
    }

    return lines.join('\n');
  }

  /**
   * Appends an interaction sample directly into the LoRA training dataset file.
   */
  public async appendTrainingSample(messages: { role: string; content: string }[]): Promise<void> {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      const sample = JSON.stringify({ messages });
      const b64 = safeBase64Encode(sample + '\n');
      const cmd = `mkdir -p "$HOME/.sentinel/training" && echo '${b64}' | base64 --decode >> "$HOME/.sentinel/training/sentinel_shell_dataset.jsonl"`;

      await invoke('execute_command', {
        command: 'sh',
        args: ['-c', cmd]
      });
    } catch {
      // Ignore file persistence errors in headless environments
    }
  }

  private appendTrainingSampleFromMemory(memory: EpisodicMemory): void {
    const osName = memory.os?.includes('win') ? 'Windows' : 'macOS';
    const messages = [
      {
        role: 'system',
        content: `You are Sentinel's autonomous shell execution copilot on ${osName}. Output JSON only: {"action": "execute", "command": "<cmd>", "explanation": "<reason>"}`
      },
      {
        role: 'user',
        content: memory.goal
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          action: 'execute',
          command: memory.command,
          explanation: memory.explanation || `Execute ${memory.command}`
        })
      }
    ];

    this.appendTrainingSample(messages);
  }

  public getAllMemories(): EpisodicMemory[] {
    return Array.from(this.memories.values());
  }

  public removeMemory(id: string): boolean {
    const removed = this.memories.delete(id);
    if (removed) this.saveMemories();
    return removed;
  }

  public clear(): void {
    this.memories.clear();
    this.saveMemories();
  }

  private tokenize(text: string): Set<string> {
    const stopWords = new Set([
      'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'can', 'you', 'please', 'me', 'my', 'i', 'want', 'need', 'would', 'could', 'all', 'some'
    ]);

    const synonyms: Record<string, string> = {
      'folder': 'dir',
      'folders': 'dir',
      'directory': 'dir',
      'directories': 'dir',
      'dirs': 'dir',
      'locate': 'find',
      'search': 'find',
      'show': 'find',
      'list': 'find',
      'display': 'find',
      'get': 'find',
      'kill': 'terminate',
      'stop': 'terminate',
      'quit': 'terminate'
    };

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, ' ')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 1 && !stopWords.has(w))
      .map(w => synonyms[w] || w);

    return new Set(words);
  }

  private calculateSimilarity(
    queryTokens: Set<string>,
    memTokens: Set<string>,
    rawQuery: string,
    rawMem: string
  ): number {
    let intersection = 0;
    for (const token of queryTokens) {
      if (memTokens.has(token)) {
        intersection++;
      }
    }
    const union = new Set([...queryTokens, ...memTokens]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    // Boost if raw query contains the memory goal or vice versa
    const lowerQ = rawQuery.toLowerCase();
    const lowerM = rawMem.toLowerCase();
    const substringBoost = (lowerQ.includes(lowerM) || lowerM.includes(lowerQ)) ? 0.35 : 0;

    return Math.min(1.0, jaccard + substringBoost);
  }

  public async loadMemories(): Promise<void> {
    if (this.isLoaded) return;
    this.isLoaded = true;

    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      const output = await invoke<{ stdout: string }>('execute_command', {
        command: 'sh',
        args: ['-c', 'cat "$HOME/.sentinel/memory/episodic_memory.json" 2>/dev/null || true']
      });

      if (output.stdout && output.stdout.trim()) {
        const parsed: EpisodicMemory[] = JSON.parse(output.stdout.trim());
        if (Array.isArray(parsed)) {
          for (const m of parsed) {
            this.memories.set(m.id, m);
          }
        }
      }
    } catch {
      // In-memory fallback
    }
  }

  public async saveMemories(): Promise<void> {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      const all = Array.from(this.memories.values());
      const jsonStr = JSON.stringify(all, null, 2);
      const b64 = safeBase64Encode(jsonStr);
      const cmd = `mkdir -p "$HOME/.sentinel/memory" && echo '${b64}' | base64 --decode > "$HOME/.sentinel/memory/episodic_memory.json"`;

      await invoke('execute_command', {
        command: 'sh',
        args: ['-c', cmd]
      });
    } catch {
      // Ignore
    }
  }
}
