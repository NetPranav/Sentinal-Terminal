/**
 * AgentLoop.ts — The Core AI Brain (ReAct Agent Loop)
 * 
 * This replaces the entire regex-based intent pipeline with a real LLM-powered
 * agent loop. The LLM decides which tool to call, sees the result, and decides
 * the next step — exactly like how a real AI agent works.
 * 
 * Flow:
 * 1. User says "connect bluetooth"
 * 2. LLM sees available tools and decides: call bluetooth.on first
 * 3. Tool executes, result fed back to LLM
 * 4. LLM decides: now scan for devices
 * 5. Tool executes, result fed back
 * 6. LLM decides: connect to the best matching device
 * 7. Done — LLM summarizes what happened
 * 
 * Falls back to regex-based fast path for ultra-simple commands,
 * and to direct shell passthrough if Ollama is unavailable.
 */

import { ModelManager } from '../management/ModelManager';
import { ToolExecutor, ToolExecutionResult } from './ToolExecutor';
import { buildToolSpecs, buildSystemPrompt, ToolSpec } from './SystemPrompt';
import { ToolRegistryState } from '../../tools/loader/ToolLoader';

export interface AgentEvent {
  type: 'thinking' | 'tool_start' | 'tool_done' | 'done' | 'error' | 'step_output';
  message: string;
  data?: any;
}

export type AgentEventListener = (event: AgentEvent) => void;

export interface AgentResult {
  success: boolean;
  summary: string;
  steps: { tool: string; params: any; result: ToolExecutionResult }[];
  cdPath?: string; // If any step navigated to a directory, capture it
}

interface LLMResponse {
  action: 'tool' | 'done' | 'error';
  tool?: string;
  params?: Record<string, any>;
  summary?: string;
  message?: string;
}

/**
 * Fast-path shortcuts that don't need an LLM.
 * These map natural language directly to tool calls for instant response.
 */
const FAST_PATHS: { pattern: RegExp; tool: string; paramsFn: (match: RegExpMatchArray, raw: string) => Record<string, any> }[] = [
  // Navigation
  { pattern: /^(?:go\s+to|navigate\s+to|take\s+me\s+to|cd|head\s+to|jump\s+to)\s+(.+)/i, tool: 'filesystem.navigate', paramsFn: (m) => ({ path: resolvePathAlias(m[1].trim()) }) },
  { pattern: /^(?:go\s+back|back|go\s+up|navigate\s+back|\.\.)\s*$/i, tool: 'filesystem.navigate', paramsFn: () => ({ path: '..' }) },
  { pattern: /^(?:go\s+home|home)\s*$/i, tool: 'filesystem.navigate', paramsFn: () => ({ path: '~' }) },

  // List files
  { pattern: /^(?:ls|list\s+files?|show\s+files?|what'?s?\s+(?:in\s+)?here)\s*$/i, tool: 'filesystem.list', paramsFn: () => ({ path: '.' }) },
  { pattern: /^(?:ls|list\s+directory|list\s+folder|show\s+directory|show\s+folder)\s+(.+)/i, tool: 'filesystem.list', paramsFn: (m) => ({ path: resolvePathAlias(m[1].trim()) }) },

  // Clear
  { pattern: /^(?:clear|clear\s+(?:terminal|screen)|clean\s+(?:terminal|screen))\s*$/i, tool: '__clear__', paramsFn: () => ({}) },

  // Simple bluetooth on/off
  { pattern: /^(?:turn\s+on|enable|activate)\s+bluetooth\s*$/i, tool: 'network.bluetooth.on', paramsFn: () => ({}) },
  { pattern: /^(?:turn\s+off|disable|deactivate)\s+bluetooth\s*$/i, tool: 'network.bluetooth.off', paramsFn: () => ({}) },

  // Simple wifi on/off
  { pattern: /^(?:turn\s+on|enable|activate)\s+(?:wifi|wi-fi)\s*$/i, tool: 'network.wifi.on', paramsFn: () => ({}) },
  { pattern: /^(?:turn\s+off|disable|deactivate)\s+(?:wifi|wi-fi)\s*$/i, tool: 'network.wifi.off', paramsFn: () => ({}) },
];

function resolvePathAlias(raw: string): string {
  const lower = raw.toLowerCase().replace(/^(?:the|a|an)\s+/i, '').replace(/\s*(folder|directory|dir)\s*/gi, '').trim();
  const aliases: Record<string, string> = {
    'downloads': '~/Downloads', 'download': '~/Downloads',
    'desktop': '~/Desktop', 'documents': '~/Documents',
    'pictures': '~/Pictures', 'photos': '~/Pictures',
    'music': '~/Music', 'movies': '~/Movies', 'videos': '~/Movies',
    'home': '~', 'root': '/',
    'project folder': '~/Project Folder', 'projects': '~/Projects',
  };
  return aliases[lower] || raw.replace(/^(?:the|a|an)\s+/i, '').replace(/\s*(?:folder|directory|dir)$/i, '').trim();
}

export class AgentLoop {
  private toolExecutor: ToolExecutor;
  private toolSpecs: ToolSpec[];
  private modelManager: ModelManager;
  private listener?: AgentEventListener;
  private conversationHistory: { role: string; content: string }[] = [];

  private static readonly MAX_STEPS = 8;

  constructor(
    private registry: ToolRegistryState,
    customModelManager?: ModelManager
  ) {
    this.toolExecutor = new ToolExecutor();
    this.toolSpecs = buildToolSpecs(registry);
    this.modelManager = customModelManager || new ModelManager();
  }

  /**
   * Set a listener for real-time agent events (for terminal output).
   */
  public onEvent(listener: AgentEventListener): void {
    this.listener = listener;
  }

  private emit(event: AgentEvent): void {
    this.listener?.(event);
  }

  /**
   * Run the agent loop for a user goal.
   * 
   * 1. Check fast-path shortcuts first
   * 2. If no shortcut matches, use LLM agent loop
   * 3. If LLM is unavailable, report error
   */
  public async run(goal: string, context: { os: string; cwd: string }): Promise<AgentResult> {
    // Strip conversational fluff from the front (but not standalone words like 'there')
    const cleaned = goal
      .replace(/^(?:(?:please|can you|could you|would you|kindly|just|now|alright|then|so|i want you to|i want to|i need you to|help me to|let's|lets)[\s,]*)+/i, '')
      .trim();

    let result: AgentResult;
    if (cleaned.length > 0) {
      const fastResult = await this.tryFastPath(cleaned, context);
      if (fastResult) {
        result = fastResult;
      } else {
        result = await this.runLLMLoop(cleaned || goal.trim(), context);
      }
    } else {
      result = await this.runLLMLoop(goal.trim(), context);
    }

    this.conversationHistory.push({ role: 'user', content: goal.trim() });
    this.conversationHistory.push({ role: 'assistant', content: result.summary });
    
    // Keep only last 10 messages (5 user/assistant pairs)
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(this.conversationHistory.length - 10);
    }

    return result;
  }

  /**
   * Try matching against fast-path shortcuts for instant response.
   */
  private async tryFastPath(goal: string, context: { os: string; cwd: string }): Promise<AgentResult | null> {
    for (const fp of FAST_PATHS) {
      const match = goal.match(fp.pattern);
      if (match) {
        const params = fp.paramsFn(match, goal);

        // Special case: clear terminal
        if (fp.tool === '__clear__') {
          return {
            success: true,
            summary: 'Terminal cleared',
            steps: [{ tool: '__clear__', params: {}, result: { success: true } }]
          };
        }

        this.emit({ type: 'tool_start', message: `Running ${fp.tool}...` });
        const result = await this.toolExecutor.execute(fp.tool, params, context.cwd);
        
        const cdPath = this.extractCdPath(fp.tool, params, result);
        const summary = result.success
          ? this.formatSuccessSummary(fp.tool, params, result)
          : `Failed: ${result.error}`;

        this.emit({ 
          type: result.success ? 'done' : 'error', 
          message: summary, 
          data: result.data 
        });

        return {
          success: result.success,
          summary,
          steps: [{ tool: fp.tool, params, result }],
          cdPath
        };
      }
    }
    return null;
  }

  /**
   * The core LLM agent loop — sends the goal to Ollama, executes tools,
   * feeds results back, and repeats until done.
   */
  private async runLLMLoop(goal: string, context: { os: string; cwd: string }): Promise<AgentResult> {
    const systemPrompt = buildSystemPrompt(this.toolSpecs, context);
    const steps: { tool: string; params: any; result: ToolExecutionResult }[] = [];
    let cdPath: string | undefined;

    // Build conversation messages
    const messages: { role: string; content: string }[] = [
      ...this.conversationHistory,
      { role: 'user', content: goal }
    ];

    this.emit({ type: 'thinking', message: 'Thinking...' });

    // Check if the embedded model is available (retry up to 15 seconds to allow sidecar to boot)
    const provider = this.modelManager.getActiveProvider();
    let isAvailable = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      isAvailable = await provider.isAvailable();
      if (isAvailable) break;
      if (attempt === 0) {
        this.emit({ type: 'thinking', message: 'Waking up embedded AI model...' });
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!isAvailable) {
      // Fallback: try to parse the goal with simple heuristics
      const fallbackResult = this.tryHeuristicFallback(goal, context);
      if (fallbackResult) return await this.executeFallback(fallbackResult, context);

      this.emit({ type: 'error', message: 'The embedded AI model is currently initializing or unavailable. Please try again in a few seconds.' });
      return {
        success: false,
        summary: 'The embedded AI model is currently initializing or unavailable.',
        steps: []
      };
    }

    const activeModel = this.modelManager.getActiveModel();
    const modelId = activeModel.modelId;

    for (let step = 0; step < AgentLoop.MAX_STEPS; step++) {
      try {
        // Build the full prompt with conversation history
        const fullPrompt = this.buildConversationPrompt(systemPrompt, messages);
        
        // Call LLM — no timeout, let the model take as long as it needs
        const response = await provider.generate(fullPrompt, modelId, {
          temperature: 0.05,
          maxTokens: 256,
          format: 'json'
        });

        // Parse LLM response
        const parsed = this.parseLLMResponse(response.content);
        if (!parsed) {
          this.emit({ type: 'error', message: 'Could not understand the instruction' });
          return {
            success: false,
            summary: 'AI could not understand the instruction. Try rephrasing.',
            steps
          };
        }

        // Handle actions
        if (parsed.action === 'done') {
          const summary = parsed.summary || 'Done';
          this.emit({ type: 'done', message: summary });
          return { success: true, summary, steps, cdPath };
        }

        if (parsed.action === 'error') {
          const errorMsg = parsed.message || 'AI reported an error';
          this.emit({ type: 'error', message: errorMsg });
          return { success: false, summary: errorMsg, steps, cdPath };
        }

        if (parsed.action === 'tool' && parsed.tool) {
          const toolId = parsed.tool;
          const params = parsed.params || {};

          // Check if tool exists
          if (!this.toolExecutor.hasDriver(toolId)) {
            // Tell the LLM the tool doesn't exist so it can try another
            messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
            messages.push({ role: 'user', content: `Error: Tool "${toolId}" not found. Available tools: ${this.toolSpecs.map(t => t.id).join(', ')}. Try a different tool.` });
            continue;
          }

          this.emit({ type: 'tool_start', message: this.getToolDisplayName(toolId) });

          // Execute the tool
          const result = await this.toolExecutor.execute(toolId, params, context.cwd);

          steps.push({ tool: toolId, params, result });

          // Capture navigation path
          const stepCd = this.extractCdPath(toolId, params, result);
          if (stepCd) cdPath = stepCd;

          if (result.success) {
            this.emit({ 
              type: 'tool_done', 
              message: this.formatSuccessSummary(toolId, params, result),
              data: result.data 
            });
          } else {
            this.emit({ 
              type: 'tool_done', 
              message: `⚠ ${result.error || 'Failed'}` 
            });
          }

          // Feed result back to LLM
          messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
          messages.push({ 
            role: 'user', 
            content: `Tool result: ${JSON.stringify({ success: result.success, data: this.truncateData(result.data), error: result.error })}. What's the next step? If the goal is achieved, respond with {"action": "done", "summary": "..."}.`
          });
        }
      } catch (err: any) {
        this.emit({ type: 'error', message: `Error: ${err.message}` });
        return {
          success: false,
          summary: `AI error: ${err.message}`,
          steps,
          cdPath
        };
      }
    }

    // Max steps reached
    const summary = steps.length > 0
      ? `Completed ${steps.length} steps (max reached)`
      : 'Could not complete the task';
    this.emit({ type: 'done', message: summary });
    return { success: steps.some(s => s.result.success), summary, steps, cdPath };
  }

  /**
   * Build a single prompt string from system prompt + conversation messages.
   * Uses a simple format that works well with Ollama's generate endpoint.
   */
  private buildConversationPrompt(systemPrompt: string, messages: { role: string; content: string }[]): string {
    let prompt = systemPrompt + '\n\n';
    for (const msg of messages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n`;
      }
    }
    prompt += 'Assistant: ';
    return prompt;
  }

  /**
   * Parse LLM JSON response, handling malformed output gracefully.
   */
  private parseLLMResponse(content: string): LLMResponse | null {
    if (!content) return null;
    
    // Sometimes the LLM outputs multiple JSON objects like:
    // {"action": "tool", ...} {"action": "tool", ...}
    // We only want to execute the FIRST one, then feed the result back.
    
    // 1. Try direct parse first (fastest for perfect output)
    try {
      const parsed = JSON.parse(content.trim());
      if (parsed.action) return parsed;
    } catch { /* fall through */ }

    // 2. Fallback: Find the first complete JSON object using brace counting
    const startIndex = content.indexOf('{');
    if (startIndex !== -1) {
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      
      for (let i = startIndex; i < content.length; i++) {
        const char = content[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
          
          if (braceCount === 0) {
            // We found the end of the first complete JSON object
            const jsonStr = content.substring(startIndex, i + 1);
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.action) return parsed;
            } catch {
              // Failed to parse extracted block
            }
            break; // Stop after finding the first complete block, even if invalid
          }
        }
      }
    }

    return null;
  }

  /**
   * Simple heuristic fallback when LLM is unavailable or times out.
   * Only handles the most common single-tool commands.
   */
  private tryHeuristicFallback(goal: string, context: { os: string; cwd: string }): { tool: string; params: Record<string, any> } | null {
    const lower = goal.toLowerCase();

    // Bluetooth
    if (lower.includes('bluetooth')) {
      if (lower.includes('on') || lower.includes('enable')) return { tool: 'network.bluetooth.on', params: {} };
      if (lower.includes('off') || lower.includes('disable')) return { tool: 'network.bluetooth.off', params: {} };
      if (lower.includes('connect')) return { tool: 'network.bluetooth.connect', params: {} };
      if (lower.includes('list') || lower.includes('scan') || lower.includes('device')) return { tool: 'network.bluetooth.list', params: {} };
    }

    // WiFi
    if (lower.includes('wifi') || lower.includes('wi-fi')) {
      if (lower.includes('on') || lower.includes('enable')) return { tool: 'network.wifi.on', params: {} };
      if (lower.includes('off') || lower.includes('disable')) return { tool: 'network.wifi.off', params: {} };
      if (lower.includes('scan') || lower.includes('list') || lower.includes('network')) return { tool: 'network.wifi.scan', params: {} };
    }

    // System info
    if (lower.includes('battery')) return { tool: 'system.battery', params: {} };
    if (lower.includes('system info') || lower.includes('specs') || lower.includes('cpu') || lower.includes('ram')) return { tool: 'system.info', params: {} };
    if (lower.includes('disk') || lower.includes('storage')) return { tool: 'system.disk', params: {} };

    // System Operations
    if (lower.includes('lock') && (lower.includes('mac') || lower.includes('screen') || lower.includes('laptop') || lower.includes('computer'))) {
      return { tool: 'system.lock', params: {} };
    }

    // Environment variables
    if (lower.includes('environment variables') || lower.includes('env variables')) {
      return { tool: 'shell.execute', params: { command: 'env' } };
    }

    // Running applications
    if (lower.includes('running applications') || lower.includes('open applications') || lower.includes('running apps')) {
      return { tool: 'application.list_running', params: {} };
    }

    // Processes
    if ((lower.includes('kill') || lower.includes('stop') || lower.includes('terminate') || lower.includes('force quit')) && !lower.includes('show') && !lower.includes('list')) {
      let target = goal.replace(/^.*(?:kill|stop|terminate|force\s+quit)\s+/i, '').replace(/\s+(?:process|app|application).*$/i, '').trim();
      if (target.toLowerCase() === 'vs code') target = 'Visual Studio Code';
      if (target.toLowerCase().includes('antigrav')) target = 'Antigravity IDE';
      if (target) return { tool: 'system.kill_process', params: { process: target } };
    }

    // Open app
    const openMatch = lower.match(/(?:open|launch)\s+(?:the\s+)?([a-z0-9\s]+?)(?:\s+application|\s+app)?(?:$|\s)/i);
    if (openMatch && openMatch[1] && !lower.includes('browser') && !lower.includes('url')) {
      let target = openMatch[1].trim();
      // Handle known aliases to prevent hallucination
      if (target.includes('antigrav')) target = 'Antigravity IDE';
      if (target === 'vs code') target = 'Visual Studio Code';
      if (target !== 'file' && target !== 'folder') {
        return { tool: 'application.open', params: { app: target } };
      }
    }

    // Update app
    const updateMatch = lower.match(/(?:update|upgrade)\s+(?:the\s+)?([a-z0-9\s]+?)(?:\s+application|\s+app)?(?:$|\s)/i);
    if (updateMatch && updateMatch[1] && !lower.includes('all')) {
      let target = updateMatch[1].trim();
      if (target.includes('antigrav')) target = 'Antigravity IDE';
      if (target === 'vs code') target = 'Visual Studio Code';
      return { tool: 'application.update', params: { app: target } };
    }

    // Scaffolding / Project Init
    if (lower.includes('initialize') || lower.includes('scaffold') || (lower.includes('make') && lower.includes('project'))) {
      const isNext = lower.includes('next');
      const isReact = lower.includes('react');
      const isDjango = lower.includes('django');
      const isExpress = lower.includes('express');
      
      if (isNext || isReact || isDjango || isExpress) {
        let frontend = isNext ? 'nextjs' : isReact ? 'react' : undefined;
        let backend = isDjango ? 'django' : isExpress ? 'express' : undefined;
        return { tool: 'developer.scaffold', params: { frontend, backend, projectName: 'new_project' } };
      }
    }

    // Filesystem search (find me all files named X)
    const searchMatch = lower.match(/(?:find|search|locate)\s+(?:me\s+)?(?:all\s+)?(?:files?\s+)?(?:named|with\s+name|matching)\s+['"]?([a-z0-9_.-]+)['"]?/i);
    if (searchMatch && searchMatch[1]) {
      return { tool: 'filesystem.search', params: { dir: '.', pattern: searchMatch[1].trim() } };
    }

    // Basic Queries (Time, User, Git)
    if (lower === 'who am i' || lower === 'whoami' || lower.includes('current user')) {
      return { tool: 'shell.execute', params: { command: 'whoami' } };
    }
    if (lower.includes('time is it') || lower.includes('show me the time') || lower.includes('current time')) {
      return { tool: 'shell.execute', params: { command: 'date +"%r %Z"' } };
    }
    if (lower.includes('what is the date') || lower.includes('show me the date') || lower.includes('current date')) {
      return { tool: 'shell.execute', params: { command: 'date +"%A, %B %d, %Y"' } };
    }
    if (lower.includes('git commit history') || lower === 'git log' || lower === 'show git log') {
      return { tool: 'git.log', params: {} };
    }

    return null;
  }

  private async executeFallback(fallback: { tool: string; params: Record<string, any> }, context: { os: string; cwd: string }): Promise<AgentResult> {
    this.emit({ type: 'tool_start', message: this.getToolDisplayName(fallback.tool) });
    const result = await this.toolExecutor.execute(fallback.tool, fallback.params, context.cwd);
    const cdPath = this.extractCdPath(fallback.tool, fallback.params, result);
    const summary = result.success
      ? this.formatSuccessSummary(fallback.tool, fallback.params, result)
      : `Failed: ${result.error}`;
    this.emit({ type: result.success ? 'done' : 'error', message: summary, data: result.data });
    return { success: result.success, summary, steps: [{ tool: fallback.tool, params: fallback.params, result }], cdPath };
  }

  /**
   * Extract a directory path if a step performed navigation.
   */
  private extractCdPath(toolId: string, params: Record<string, any>, result: ToolExecutionResult): string | undefined {
    if (toolId === 'filesystem.navigate' || toolId === 'filesystem.cd' || toolId === 'shell.cd') {
      return result.data?.path || params.path || params.directory;
    }
    if (result.data?.path && typeof result.data.path === 'string' && (result.data.stdout || '').includes('Changed directory')) {
      return result.data.path;
    }
    return undefined;
  }

  /**
   * Format a clean one-line success summary for the user.
   */
  private formatSuccessSummary(toolId: string, params: Record<string, any>, result: ToolExecutionResult): string {
    const domain = toolId.split('.')[0];
    const action = toolId.split('.').slice(1).join('.');

    switch (toolId) {
      case 'network.bluetooth.on': return '✓ Bluetooth turned on';
      case 'network.bluetooth.off': return '✓ Bluetooth turned off';
      case 'network.bluetooth.connect': return `✓ Connected to ${params.device || 'device'}`;
      case 'network.bluetooth.list': return `✓ Found ${result.data?.devices?.length || 0} Bluetooth devices`;
      case 'network.wifi.on': return '✓ WiFi turned on';
      case 'network.wifi.off': return '✓ WiFi turned off';
      case 'network.wifi.connect': return `✓ Connected to ${params.ssid || 'network'}`;
      case 'network.wifi.scan': return `✓ Found ${result.data?.networks?.length || 0} WiFi networks`;
      case 'filesystem.navigate': return `✓ Navigated to ${params.path || params.directory}`;
      case 'filesystem.list': return `✓ Listed ${result.data?.entries?.length || result.data?.files?.length || 0} items`;
      case 'filesystem.mkdir': return `✓ Created folder: ${params.path || params.name}`;
      case 'filesystem.create': return `✓ Created file: ${params.file || params.path}`;
      case 'filesystem.delete': return `✓ Deleted: ${params.path}`;
      case 'filesystem.search': return `✓ Found ${result.data?.matches?.length || result.data?.results?.length || 0} matches`;
      case 'system.kill_process': return `✓ Stopped ${params.process || params.app}`;
      case 'application.open': return `✓ Opened ${params.app || params.name}`;
      case 'application.force_quit': return `✓ Force quit ${params.app || params.process}`;
      case 'browser.navigate': return `✓ Opened ${params.url}`;
      case 'browser.search': return `✓ Searched: ${params.query}`;
      case 'system.battery': return `✓ Battery: ${result.data?.percentage || result.data?.level || 'unknown'}%`;
      case 'system.info': return '✓ System info retrieved';
      default: return `✓ ${toolId.replace(/\./g, ' ')} completed`;
    }
  }

  /**
   * Get a human-friendly display name for a tool.
   */
  private getToolDisplayName(toolId: string): string {
    const names: Record<string, string> = {
      'network.bluetooth.on': 'Turning on Bluetooth...',
      'network.bluetooth.off': 'Turning off Bluetooth...',
      'network.bluetooth.connect': 'Connecting Bluetooth device...',
      'network.bluetooth.list': 'Scanning Bluetooth devices...',
      'network.wifi.on': 'Turning on WiFi...',
      'network.wifi.off': 'Turning off WiFi...',
      'network.wifi.connect': 'Connecting to WiFi...',
      'network.wifi.scan': 'Scanning WiFi networks...',
      'filesystem.navigate': 'Navigating...',
      'filesystem.list': 'Listing files...',
      'filesystem.mkdir': 'Creating folder...',
      'filesystem.create': 'Creating file...',
      'filesystem.delete': 'Deleting...',
      'filesystem.search': 'Searching...',
      'filesystem.read': 'Reading file...',
      'system.kill_process': 'Stopping process...',
      'application.open': 'Opening application...',
      'application.force_quit': 'Force quitting...',
      'browser.navigate': 'Opening in browser...',
      'browser.search': 'Searching the web...',
      'system.battery': 'Checking battery...',
      'system.info': 'Getting system info...',
    };
    return names[toolId] || `Running ${toolId}...`;
  }

  /**
   * Truncate large data objects before feeding back to LLM to save tokens.
   */
  private truncateData(data: any): any {
    if (!data) return data;
    const str = JSON.stringify(data);
    if (str.length > 2000) {
      // Truncate arrays to first 10 items, truncate strings to 500 chars
      if (Array.isArray(data)) return data.slice(0, 10);
      if (typeof data === 'object') {
        const truncated: Record<string, any> = {};
        for (const [k, v] of Object.entries(data)) {
          if (typeof v === 'string' && v.length > 500) {
            truncated[k] = v.substring(0, 500) + '... (truncated)';
          } else if (Array.isArray(v)) {
            truncated[k] = v.slice(0, 10);
          } else {
            truncated[k] = v;
          }
        }
        return truncated;
      }
    }
    return data;
  }
}
