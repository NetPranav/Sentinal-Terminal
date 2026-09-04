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
import { ExecutionPreviewPlan } from '../../domain/security/ExecutionEngine';
import { EmbeddedEngineManager } from '../models/EmbeddedEngineManager';

export interface AgentEvent {
  type: 'thinking' | 'plan' | 'question' | 'tool_start' | 'tool_done' | 'done' | 'error' | 'step_output';
  message: string;
  data?: any;
}

export type AgentEventListener = (event: AgentEvent) => void;
export type AgentAuthorizationHandler = (plan: ExecutionPreviewPlan) => Promise<boolean>;

export interface AgentResult {
  success: boolean;
  summary: string;
  steps: { tool: string; params: any; result: ToolExecutionResult }[];
  cdPath?: string; // If any step navigated to a directory, capture it
  awaitingInput?: boolean;
}

import { AdaptivePlanEngine, AgentPlan, PlanPhase, PhaseStatus } from './AdaptivePlanEngine';
import { ProjectDiscoveryEngine } from '../../domain/discovery/ProjectDiscoveryEngine';
import { ToolParameterValidator } from './ToolParameterValidator';
import { DynamicToolPruner } from './DynamicToolPruner';
import { DemonstrationLearningEngine } from '../../domain/learning/DemonstrationLearningEngine';
export { AdaptivePlanEngine, ToolParameterValidator, DynamicToolPruner, DemonstrationLearningEngine };
export type { AgentPlan, PlanPhase, PhaseStatus };

interface LLMResponse {
  action: 'tool' | 'done' | 'error';
  tool?: string;
  params?: Record<string, any>;
  summary?: string;
  message?: string;
}

interface PendingClarification {
  goal: string;
  plan: AgentPlan;
}

/**
 * Fast-path shortcuts that don't need an LLM.
 * These map natural language directly to tool calls for instant response.
 */
const FAST_PATHS: {
  pattern: RegExp;
  tool: string;
  paramsFn: (match: RegExpMatchArray, raw: string) => Record<string, any>;
  /** Prevent broad regexes from taking ownership of an ambiguous natural-language request. */
  shouldHandle?: (goal: string) => boolean;
}[] = [
  // Web browser navigation & URL shortcuts (with optional target browser)
  {
    pattern: /^(?:open|navigate\s+to|visit|browse\s+to|browse|view)\s+((?:https?:\/\/|www\.)[^\s]+)(?:\s+(?:in|using|with)\s+([a-z0-9_\s]+))?$/i,
    tool: 'browser.navigate',
    paramsFn: (m) => ({ url: m[1].trim(), ...(m[2] ? { appName: m[2].trim() } : {}) })
  },
  {
    pattern: /^(?:open|navigate\s+to|visit|browse\s+to|browse|view)\s+((?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|dev|co|app|me|edu|gov|xyz|info|tv|rs|sh|cc|uk|de|in|ca|fr|jp|tech|site|space|online|to|fm)(?:\/[^\s]*)?)(?:\s+(?:in|using|with)\s+([a-z0-9_\s]+))?$/i,
    tool: 'browser.navigate',
    paramsFn: (m) => ({ url: m[1].trim(), ...(m[2] ? { appName: m[2].trim() } : {}) })
  },
  // "go to <url>" (differentiated from filesystem path)
  {
    pattern: /^(?:go\s+to)\s+((?:https?:\/\/|www\.)[^\s]+)(?:\s+(?:in|using|with)\s+([a-z0-9_\s]+))?$/i,
    tool: 'browser.navigate',
    paramsFn: (m) => ({ url: m[1].trim(), ...(m[2] ? { appName: m[2].trim() } : {}) })
  },
  {
    pattern: /^(?:go\s+to)\s+((?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|dev|co|app|me|edu|gov|xyz|info|tv|rs|sh|cc|uk|de|in|ca|fr|jp|tech|site|space|online|to|fm)(?:\/[^\s]*)?)(?:\s+(?:in|using|with)\s+([a-z0-9_\s]+))?$/i,
    tool: 'browser.navigate',
    paramsFn: (m) => ({ url: m[1].trim(), ...(m[2] ? { appName: m[2].trim() } : {}) })
  },
  // Bare URL direct navigation without verbs (e.g. "github.com", "https://news.ycombinator.com")
  {
    pattern: /^((?:https?:\/\/|www\.)[^\s]+)$/i,
    tool: 'browser.navigate',
    paramsFn: (m) => ({ url: m[1].trim() })
  },
  {
    pattern: /^((?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|dev|co|app|me|edu|gov|xyz|info|tv|rs|sh|cc|uk|de|in|ca|fr|jp|tech|site|space|online|to|fm)(?:\/[^\s]*)?)$/i,
    tool: 'browser.navigate',
    paramsFn: (m) => ({ url: m[1].trim() })
  },
  // Web search direct fast paths
  {
    pattern: /^(?:search\s+google\s+for|google)\s+(.+)$/i,
    tool: 'browser.search',
    paramsFn: (m) => ({ query: m[1].trim(), engine: 'google' })
  },
  {
    pattern: /^(?:search\s+youtube\s+for|youtube)\s+(.+)$/i,
    tool: 'browser.search',
    paramsFn: (m) => ({ query: m[1].trim(), engine: 'youtube' })
  },
  {
    pattern: /^(?:search\s+github\s+for|github)\s+(.+)$/i,
    tool: 'browser.search',
    paramsFn: (m) => ({ query: m[1].trim(), engine: 'github' })
  },
  {
    pattern: /^(?:search\s+(?:the\s+)?web\s+for|web\s+search(?:\s+for)?)\s+(.+)$/i,
    tool: 'browser.search',
    paramsFn: (m) => ({ query: m[1].trim(), engine: 'google' })
  },

  // Navigation
  { pattern: /^(?:go\s+to|navigate\s+to|take\s+me\s+to|cd|head\s+to|jump\s+to)\s+(.+)/i, tool: 'filesystem.navigate', paramsFn: (m) => ({ path: resolvePathAlias(m[1].trim()) }) },
  { pattern: /^(?:go\s+back|back|go\s+up|navigate\s+back|\.\.)\s*$/i, tool: 'filesystem.navigate', paramsFn: () => ({ path: '..' }) },
  { pattern: /^(?:go\s+home|home)\s*$/i, tool: 'filesystem.navigate', paramsFn: () => ({ path: '~' }) },

  // List files
  { pattern: /^(?:ls|list\s+files?|show\s+files?|what'?s?\s+(?:in\s+)?here)\s*$/i, tool: 'filesystem.list', paramsFn: () => ({ path: '.' }) },
  { pattern: /^(?:ls|list\s+files?\s+(?:in|at)|list\s+directory|list\s+folder|show\s+directory|show\s+folder|show\s+files?\s+(?:in|at))\s+(.+)/i, tool: 'filesystem.list', paramsFn: (m) => ({ path: resolvePathAlias(m[1].trim()) }) },

  // Clear
  { pattern: /^(?:clear|clear\s+(?:terminal|screen)|clean\s+(?:terminal|screen))\s*$/i, tool: '__clear__', paramsFn: () => ({}) },

  // Simple bluetooth on/off
  { pattern: /^(?:turn\s+on|enable|activate)\s+bluetooth\s*$/i, tool: 'network.bluetooth.on', paramsFn: () => ({}) },
  { pattern: /^(?:turn\s+off|disable|deactivate)\s+bluetooth\s*$/i, tool: 'network.bluetooth.off', paramsFn: () => ({}) },

  // Simple wifi on/off & network scanning
  { pattern: /^(?:turn\s+on|enable|activate)\s+(?:wifi|wi-fi)\s*$/i, tool: 'network.wifi.on', paramsFn: () => ({}) },
  { pattern: /^(?:turn\s+off|disable|deactivate)\s+(?:wifi|wi-fi)\s*$/i, tool: 'network.wifi.off', paramsFn: () => ({}) },
  {
    pattern: /^(?:(?:can\s+you\s+)?(?:check|list|show|get|view|what\s+are|see)\s+(?:for\s+)?(?:all\s+)?(?:the\s+)?(?:available|saved|preferred|connected|known|past|previous|history\s+of)?\s*(?:wifi|wi-fi)\s*(?:networks?|connections?|ssids?)|(?:all\s+)?(?:the\s+)?(?:saved|connected|previous|known)?\s*(?:wifi|wi-fi)\s*networks?\s*(?:i\s+(?:have\s+)?(?:been\s+)?connected\s+to|saved|known|available)?)$/i,
    tool: 'network.wifi.scan',
    paramsFn: () => ({})
  },

  // Simple system & hardware checks
  { pattern: /^(?:what\s+is\s+my\s+battery(?:\s+level|\s+status)?|battery\s+level|battery\s+status|show\s+battery|battery)\s*$/i, tool: 'system.battery', paramsFn: () => ({}) },
  { pattern: /^(?:system\s+info|os\s+info|sysinfo|about\s+my\s+mac|hardware\s+info)\s*$/i, tool: 'system.info', paramsFn: () => ({}) },
  { pattern: /^(?:running\s+processes|list\s+processes|show\s+processes|which\s+process\s+is\s+using\s+the\s+most\s+cpu|top\s+cpu(?:\s+processes)?|most\s+cpu|ps)\s*$/i, tool: 'system.processes', paramsFn: () => ({ sort: 'cpu' }) },
  { pattern: /^(?:top\s+ram(?:\s+processes)?|most\s+ram|top\s+memory)\s*$/i, tool: 'system.processes', paramsFn: () => ({ sort: 'ram' }) },
  { pattern: /^(?:check\s+available\s+disk\s+space|available\s+disk\s+space|disk\s+space|storage\s+space|storage|df)\s*$/i, tool: 'system.storage', paramsFn: () => ({}) },

  // Network checks
  { pattern: /^(?:check\s+if\s+port|check\s+port|is\s+port|port)\s+(\d+)(?:\s+(?:is\s+)?in\s+use|\s+open)?/i, tool: 'network.ports', paramsFn: (m) => ({ port: parseInt(m[1], 10) }) },
  { pattern: /^(?:check\s+open\s+ports|open\s+ports|listening\s+ports|list\s+ports|ports)\s*$/i, tool: 'network.ports', paramsFn: () => ({}) },
  { pattern: /^(?:ping|test\s+connection\s+to|ping\s+host)\s+([a-z0-9_.-]+)/i, tool: 'network.ping', paramsFn: (m) => ({ host: m[1] }) },

  // Git shortcuts
  { pattern: /^(?:git\s+status|check\s+git\s+status|show\s+git\s+status|branch\s+status)\s*$/i, tool: 'git.status', paramsFn: () => ({}) },
  { pattern: /^(?:git\s+log|recent\s+commits?|commit\s+history|show\s+git\s+log)\s*$/i, tool: 'git.log', paramsFn: () => ({}) },

  // Search & Find files & folders
  {
    pattern: /^(?:(?:can\s+you\s+)?(?:tell\s+me|find|search|locate|show|list)\s+(?:all\s+)?(?:the\s+)?(?:files?|folders?|directories)?\s*(?:for\s+)?[\s\S]+)/i,
    tool: 'filesystem.search',
    paramsFn: (_m, goal) => parseSearchQuery(goal),
    shouldHandle: isExplicitFilesystemSearch
  },

  // Application & Folder shortcuts
  {
    pattern: /^(?:open|launch|start)\s+(?:the\s+)?(?:application|app)\s+([a-z0-9_.\s-]+)/i,
    tool: 'application.open',
    paramsFn: (m) => ({ app: m[1].trim() })
  },
  {
    pattern: /^(?:open|launch|start)\s+(?:the\s+)?(chrome|google\s+chrome|safari|firefox|brave|edge|vscode|vs\s+code|code|cursor|discord|slack|spotify|terminal|finder|notes|calendar|calculator|mail|messages|sublime|pycharm|intellij|webstorm|sentinel|sentinel\s+terminal|antigravity|antigravity\s+ide)\s*$/i,
    tool: 'application.open',
    paramsFn: (m) => ({ app: m[1].trim() })
  },
  {
    pattern: /^(?:open|show)\s+(?:the\s+)?(?:build\s+folder|build\s+dir(?:ectory)?|release\s+folder|release\s+dir(?:ectory)?)\s*$/i,
    tool: 'application.open',
    paramsFn: () => ({ app: 'build folder' })
  },
  {
    pattern: /^(?:open|show)\s+(?:the\s+)?(?:downloads|desktop|documents|pictures|music|movies|project\s+folder)\s*(?:folder|dir(?:ectory)?)?\s*$/i,
    tool: 'application.open',
    paramsFn: (m) => ({ app: m[1].trim() })
  },
  // System Service management (start, stop, restart, enable, disable, status)
  {
    pattern: /^(?:(start|stop|restart|enable|disable|status)\s+)?(?:service\s+)?([a-z0-9_.-]+)\s+service\s*$/i,
    tool: 'system.service',
    paramsFn: (m) => ({ service: m[2].trim(), action: (m[1] || 'status').toLowerCase() })
  },
  {
    pattern: /^(?:(start|stop|restart|enable|disable)\s+service\s+([a-z0-9_.-]+))\s*$/i,
    tool: 'system.service',
    paramsFn: (m) => ({ service: m[2].trim(), action: m[1].toLowerCase() })
  },
  // Dotfile rice autostart toggling (turn on/off, enable/disable in rice/hyprland/i3)
  {
    pattern: /^(?:turn\s+(on|off)|enable|disable)\s+([a-z0-9_.-]+)\s+(?:in\s+rice|on\s+startup|in\s+autostart|in\s+(hyprland|i3|sway))\s*$/i,
    tool: 'system.dotfile',
    paramsFn: (m) => ({
      app: m[2].trim(),
      enable: m[1] === 'on' || m[0].toLowerCase().startsWith('enable'),
      target: m[3] ? m[3].toLowerCase() : 'hyprland'
    })
  }
];

/**
 * Keep the no-model search shortcut deliberately narrow.  A broad "search ..."
 * matcher incorrectly turns requests such as "search the web for Rust" into a
 * local file search.  Ambiguous requests should reach the LLM, which has the
 * full browser and filesystem tool context to make that decision.
 */
export function isExplicitFilesystemSearch(goal: string): boolean {
  const query = goal.trim();
  return /\b(?:file|files|folder|folders|directory|directories|path)\b/i.test(query)
    || /(?:^|\s)(?:\*|[a-z0-9_-]+)\.[a-z0-9]+\b/i.test(query)
    || /\b(?:named|matching|with\s+name|pattern)\s+['"]?[^'"\s]+/i.test(query);
}

/**
 * A cheap routing decision protects small local models from unnecessary planning.
 * Simple commands go straight to execution; workflows and uncertain operations get
 * one compact planning pass before any tool can run.
 */
export function requiresExecutionPlan(goal: string): boolean {
  const normalized = goal.trim().toLowerCase();
  if (!normalized) return false;

  const hasWorkflowConnector = /(?:\s&&\s|;|\b(?:and then|then|after|before|once)\b)/.test(normalized);
  const hasMultipleActions = /\b(?:install|create|build|test|run|deploy|migrate|configure|fix|debug|backup|restore|convert)\b[\s\S]*\b(?:and|then)\b/.test(normalized);
  const needsPreparation = /\b(?:set up|setup|bootstrap|scaffold|deploy|release|migrate|upgrade|downgrade|debug|troubleshoot|diagnose|workflow|automate|backup|restore|sync)\b/.test(normalized);
  const isMultiStepOrAmbiguous = /\b(?:connect\s+bluetooth|pair\s+bluetooth|bluetooth\s+connect|switch\s+branch|checkout\s+branch)\b/.test(normalized)
    || /^(?:open|launch|start|run)\s+(?:the\s+|an?\s+)?(?:application|app)$/.test(normalized);

  return hasWorkflowConnector || hasMultipleActions || needsPreparation || isMultiStepOrAmbiguous;
}

function parseSearchQuery(raw: string): { dir: string; pattern: string; type?: string } {
  let dir = '.';
  let pattern = '*';
  let clean = raw.trim();

  // Strip conversational greetings & politeness
  clean = clean.replace(/^(?:hey(?:\s+there)?|hi|hello|yo|please|can\s+you|could\s+you)[\s,]+/gi, '');
  clean = clean.replace(/^(?:can\s+you\s+)?(?:tell\s+me|find|search|locate|show|list|get)\s+/i, '');
  clean = clean.replace(/^all\s+(?:the\s+)?/i, '');
  clean = clean.replace(/\s+with\s+(?:there|their)\s+paths?/i, '');
  clean = clean.trim();

  let type: string | undefined = undefined;
  if (/\b(?:folders?|directories|dirs)\b/i.test(clean)) {
    type = 'directory';
  }

  // Extract directory (e.g. "in tools directory", "under src", "in ~/Downloads", "in my system")
  const inMatch = clean.match(/\s+(?:in|under|inside)\s+([~/a-z0-9_.-]+(?:\s+[a-z0-9_.-]+)*)/i);
  if (inMatch && inMatch[1]) {
    dir = resolvePathAlias(inMatch[1]);
    clean = clean.replace(inMatch[0], '').trim();
  }

  clean = clean.replace(/^(?:for\s+|all\s+|the\s+)*/i, '').trim();

  // 1. Check explicit named / matching target first (e.g. "named as frontend", "named fronted")
  const nameMatch = clean.match(/(?:named|with\s+name|matching|pattern)\s+(?:as\s+)?['"]?([a-z0-9_.*-]+)['"]?/i);
  if (nameMatch && nameMatch[1]) {
    pattern = nameMatch[1];
  } else {
    // 2. Check "<target> (folders|directories|files)" e.g. "frontend folders"
    const targetFolderMatch = clean.match(/^([a-z0-9_.*-]+)\s+(?:folders?|directories|dirs|files?)\b/i);
    if (targetFolderMatch && targetFolderMatch[1]) {
      const candidate = targetFolderMatch[1].toLowerCase();
      const stopWords = ['all', 'the', 'some', 'any', 'my', 'locate', 'search', 'find', 'these', 'those'];
      if (!stopWords.includes(candidate)) {
        pattern = targetFolderMatch[1];
      }
    } else {
      // 3. Check extension (e.g. "json files", "*.ts")
      const extMatch = clean.match(/\b([a-z0-9_-]+)\s+files?\b/i);
      const stopWords = ['all', 'the', 'some', 'any', 'my', 'locate', 'search', 'find', 'for', 'these', 'those', 'large'];
      if (extMatch && extMatch[1] && !stopWords.includes(extMatch[1].toLowerCase())) {
        pattern = `*.${extMatch[1]}`;
      } else {
        const stripped = clean.replace(/\b(?:folders?|directories|dirs|files?)\b/gi, '').trim();
        if (stripped && stripped !== '*' && stripped !== 'all') {
          pattern = stripped;
        }
      }
    }
  }

  return { dir, pattern, type };
}

function resolvePathAlias(raw: string): string {
  const lower = raw.toLowerCase().replace(/^(?:the|a|an)\s+/i, '').replace(/\s*(folder|directory|dir)\s*/gi, '').trim();
  const aliases: Record<string, string> = {
    'downloads': '~/Downloads', 'download': '~/Downloads',
    'desktop': '~/Desktop', 'documents': '~/Documents',
    'pictures': '~/Pictures', 'photos': '~/Pictures',
    'music': '~/Music', 'movies': '~/Movies', 'videos': '~/Movies',
    'home': '~', 'root': '/',
    'project folder': '~/Project Folder', 'projects': '~/Projects',
    'system': '~', 'my system': '~', 'mac': '~', 'computer': '~', 'my mac': '~', 'my computer': '~'
  };
  return aliases[lower] || raw.replace(/^(?:the|a|an)\s+/i, '').replace(/\s*(?:folder|directory|dir)$/i, '').trim();
}

/**
 * Find matching fast path definition and extracted parameters for a goal.
 */
export function findFastPath(goal: string): { tool: string; params: Record<string, any> } | null {
  const cleanGoal = goal.trim().replace(/^(?:hey(?:\s+there)?|hi|hello|yo|please)[\s,]+/i, '');
  for (const fp of FAST_PATHS) {
    const match = cleanGoal.match(fp.pattern) || goal.match(fp.pattern);
    if (match && (!fp.shouldHandle || fp.shouldHandle(goal))) {
      return { tool: fp.tool, params: fp.paramsFn(match, goal) };
    }
  }
  return null;
}

export class AgentLoop {
  private toolExecutor: ToolExecutor;
  private toolSpecs: ToolSpec[];
  private modelManager: ModelManager;
  private listener?: AgentEventListener;
  private authorizationHandler?: AgentAuthorizationHandler;
  private conversationHistory: { role: string; content: string }[] = [];
  private pendingClarification?: PendingClarification;

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

  /** Supply the desktop confirmation flow for actions that need approval. */
  public setAuthorizationHandler(handler: AgentAuthorizationHandler): void {
    this.authorizationHandler = handler;
  }

  /** True while the next terminal entry should be treated as an answer for the agent. */
  public hasPendingQuestion(): boolean {
    return this.pendingClarification !== undefined;
  }

  public cancelPendingQuestion(): void {
    this.pendingClarification = undefined;
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
    const answer = goal.trim();
    if (this.pendingClarification && answer) {
      const pending = this.pendingClarification;
      this.pendingClarification = undefined;

      // Check if this clarification was for workspace project disambiguation
      if (pending.plan.discoveredProjects && pending.plan.discoveredProjects.length > 0) {
        const selected = ProjectDiscoveryEngine.resolveSelection(answer, pending.plan.discoveredProjects);
        if (selected) {
          const adaptiveEngine = new AdaptivePlanEngine();
          const executionPlan = adaptiveEngine.createProjectExecutionPlan(selected, pending.goal);
          this.emit({ type: 'plan', message: executionPlan.summary, data: executionPlan });
          const execRes = await adaptiveEngine.executePlan(pending.goal, executionPlan, {
            cwd: context.cwd,
            os: context.os,
            onPlanUpdate: (updatedPlan) => this.emit({ type: 'plan', message: updatedPlan.summary, data: updatedPlan }),
            onPhaseStart: (phase) => this.emit({ type: 'tool_start', message: `Phase ${phase.id}: ${phase.title}` }),
            onPhaseDone: (phase) => this.emit({ type: 'tool_done', message: `✓ Phase ${phase.id}: ${phase.title}` }),
            onStepOutput: (output) => this.emit({ type: 'step_output', message: output }),
            toolExecutor: this.toolExecutor,
            authorizationHandler: this.authorizationHandler
          });
          this.emit({ type: 'done', message: execRes.summary });
          return {
            success: execRes.success,
            summary: execRes.summary,
            steps: execRes.steps.map(s => ({ tool: s.tool, params: s.params, result: s.result })),
            cdPath: execRes.cdPath
          };
        }
      }

      goal = `${pending.goal}\nUser clarification: ${answer}`;
    }

    // Conversational greetings & status fast paths (works instantly offline)
    const rawLower = goal.trim().toLowerCase();
    if (/^(?:hey|hi|hello|yo|howdy|sup|greetings)(?:\s+there)?[\s!.]*$/i.test(rawLower)) {
      const greeting = "Hey there! I am Sentinel AI, your local terminal copilot. You can ask me to inspect listening ports, find high CPU tasks, scaffold projects, automate git workflows, or diagnose broken shell commands.";
      this.emit({ type: 'done', message: greeting });
      return { success: true, summary: greeting, steps: [] };
    }

    if (/^(?:who\s+are\s+you|what\s+can\s+you\s+do|help|what\s+is\s+sentinel)[\s?!.]*$/i.test(rawLower)) {
      const helpMsg = "I am Sentinel AI — an autonomous terminal agent. You can ask me to:\n• Inspect listening ports: \">what is using port 3000\"\n• Kill zombie processes: \">kill node\"\n• Git actions: \">create a feature branch named auth\"\n• Fix shell errors: Press [Tab] on the Auto-Heal banner\n• Switch projects: Press Cmd+O\n• Search history: Press Ctrl+R\n• Manage Embedded AI (Qwen 2.5 3B): Press Cmd+Shift+P > 'Sentinel Embedded AI'";
      this.emit({ type: 'done', message: helpMsg });
      return { success: true, summary: helpMsg, steps: [] };
    }

    if (/^(?:(?:what\s+is\s+(?:the\s+)?(?:current\s+)?(?:time|date|day))|current\s+(?:time|date)|what\s+time\s+is\s+it|what\s+is\s+today'?s?\s+date|date|time)[\s?!.]*$/i.test(rawLower)) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateTimeMsg = `The current date and time is ${dateStr}, ${timeStr}.`;
      this.emit({ type: 'done', message: dateTimeMsg });
      return { success: true, summary: dateTimeMsg, steps: [] };
    }

    if (/^(?:setup-?ai|download-?model|install-?model|get-?model)[\s]*$/i.test(rawLower)) {
      this.emit({ type: 'tool_start', message: 'Initiating Sentinel Embedded AI download (Qwen 2.5 Coder 3B)...' });
      EmbeddedEngineManager.getInstance().downloadRecommendedModel().then(async (ok) => {
        if (ok) {
          await EmbeddedEngineManager.getInstance().startEngine();
        }
      });
      const msg = "Starting download of Qwen 2.5 Coder 3B (~1.9 GB) into ~/.sentinel/models/...\nYou can monitor progress in Command Palette (Cmd+Shift+P > 'Sentinel Embedded AI').";
      this.emit({ type: 'done', message: msg });
      return { success: true, summary: msg, steps: [] };
    }

    // Strip conversational fluff from the front (but not standalone words like 'there')
    const cleaned = goal
      .replace(/^(?:(?:please|can you|could you|would you|kindly|just|now|alright|then|so|i want you to|i want to|i need you to|help me to|let's|lets)[\s,]*)+/i, '')
    // 0. Check Learned Patterns from Demonstration / Human Corrections
    const learnedEngine = DemonstrationLearningEngine.getInstance();
    const learnedMatch = learnedEngine.matchGoal(cleaned || goal);
    if (learnedMatch.matched && learnedMatch.interpolatedCommand) {
      this.emit({
        type: 'thinking',
        message: `💡 Using learned workflow: ${learnedMatch.interpolatedCommand}`
      });

      const params = {
        command: learnedMatch.interpolatedCommand,
        explanation: learnedMatch.explanation || `Using learned pattern: ${learnedMatch.interpolatedCommand}`
      };

      this.emit({ type: 'tool_start', message: 'Executing learned workflow...' });
      const toolRes = await this.toolExecutor.execute(
        'shell.execute',
        params,
        context.cwd,
        this.authorizationHandler
      );

      const success = toolRes.success;
      const summary = success
        ? `✓ Executed learned workflow: ${learnedMatch.interpolatedCommand}`
        : `⚠ Failed to execute learned workflow: ${toolRes.error || 'unknown error'}`;

      this.emit({ type: success ? 'done' : 'error', message: summary });

      const cdPath = this.extractCdPath('shell.execute', params, toolRes);
      return {
        success,
        summary,
        steps: [{ tool: 'shell.execute', params, result: toolRes }],
        cdPath
      };
    }

    // When the AI engine is available, ALWAYS route user requests directly to the LLM model
    // so the AI understands, reasons, selects tools, and executes dynamically.
    // Local fast paths are strictly reserved as an offline fallback when no AI engine is active.
    let isAIAvailable = await this.modelManager.getActiveProvider().isAvailable();
    if (!isAIAvailable) {
      const embeddedMgr = EmbeddedEngineManager.getInstance();
      if (await embeddedMgr.checkModelExists()) {
        isAIAvailable = true;
      }
    }

    let result: AgentResult;
    if (isAIAvailable) {
      result = await this.runLLMLoop(goal.trim(), context);
    } else {
      const fastResult = await this.tryFastPath(cleaned || goal.trim(), context);
      if (fastResult) {
        result = fastResult;
      } else {
        result = await this.runLLMLoop(goal.trim(), context);
      }
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
    const matched = findFastPath(goal);
    if (matched) {
      const { tool, params } = matched;

      this.emit({ type: 'thinking', message: 'Using a quick local command match (no AI inference).' });

      // Special case: clear terminal
      if (tool === '__clear__') {
        return {
          success: true,
          summary: 'Terminal cleared',
          steps: [{ tool: '__clear__', params: {}, result: { success: true } }]
        };
      }

      this.emit({ type: 'tool_start', message: `Running ${tool}...` });
      const result = await this.toolExecutor.execute(tool, params, context.cwd, this.authorizationHandler);
      
      const cdPath = this.extractCdPath(tool, params, result);
      const summary = result.success
        ? (result.data?.stdout || this.formatSuccessSummary(tool, params, result))
        : `Failed: ${result.error}`;

      this.emit({ 
        type: result.success ? 'done' : 'error', 
        message: summary,
        data: result.data
      });

      return {
        success: result.success,
        summary,
        steps: [{ tool, params, result }],
        cdPath
      };
    }

    return null;
  }

  /**
   * The core LLM agent loop — sends the goal to Ollama, executes tools,
   * feeds results back, and repeats until done.
   */
  private async runLLMLoop(goal: string, context: { os: string; cwd: string }): Promise<AgentResult> {
    const systemPrompt = buildSystemPrompt(this.toolSpecs, context, goal);
    const steps: { tool: string; params: any; result: ToolExecutionResult }[] = [];
    let cdPath: string | undefined;

    // Build conversation messages
    const messages: { role: string; content: string }[] = [
      ...this.conversationHistory,
      { role: 'user', content: goal }
    ];

    this.emit({ type: 'thinking', message: 'Thinking...' });

    // Discover and check available AI provider (Embedded llama.cpp, Ollama, etc.)
    let provider = this.modelManager.getActiveProvider();
    let isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      try {
        await this.modelManager.initialize();
        provider = this.modelManager.getActiveProvider();
        isAvailable = await provider.isAvailable();
      } catch {
        // ignore initialization probe errors
      }
    }

    if (!isAvailable) {
      // Retry for embedded sidecar if it is still booting
      for (let attempt = 0; attempt < 3; attempt++) {
        isAvailable = await provider.isAvailable();
        if (isAvailable) break;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!isAvailable) {
      try {
        const embeddedMgr = EmbeddedEngineManager.getInstance();
        const hasModel = await embeddedMgr.checkModelExists();
        if (hasModel) {
          this.emit({ type: 'tool_start', message: 'Starting Sentinel Embedded AI engine...' });
          await embeddedMgr.startEngine();
          for (let attempt = 0; attempt < 5; attempt++) {
            if (await provider.isAvailable()) {
              isAvailable = true;
              break;
            }
            await new Promise(r => setTimeout(r, 800));
          }
        }
      } catch { /* ignore */ }
    }

    if (!isAvailable) {
      // Fallback: try to parse the goal with simple heuristics
      const fallbackResult = this.tryHeuristicFallback(goal, context);
      if (fallbackResult) return await this.executeFallback(fallbackResult, context);

      const guidanceMsg = 
        `Local AI model is not running yet.\n\n` +
        `⚡ Option 1 (No Ollama needed): Type ">setup-ai" or open Command Palette (Cmd+Shift+P) > "Sentinel Embedded AI" to 1-click download Qwen 2.5 Coder 3B.\n` +
        `🔌 Option 2 (External Ollama): Start Ollama in your terminal: 'ollama run qwen2.5-coder:3b'`;

      this.emit({ type: 'error', message: guidanceMsg });
      return {
        success: false,
        summary: 'Local AI model not running yet. Use >setup-ai or start Ollama.',
        steps: []
      };
    }

    const activeModel = this.modelManager.getActiveModel();
    const modelId = activeModel.modelId;

    if (requiresExecutionPlan(goal)) {
      const adaptiveEngine = new AdaptivePlanEngine(provider, modelId);
      const plan = await adaptiveEngine.createPlan(goal, context);
      if (plan) {
        this.emit({ type: 'plan', message: plan.summary, data: plan });

        if (plan.question) {
          this.pendingClarification = { goal, plan };
          this.emit({ type: 'question', message: plan.question, data: plan });
          return {
            success: false,
            summary: plan.question,
            steps: [],
            awaitingInput: true
          };
        }

        // Execute phase by phase with adaptive early completion & sub-phase expansion
        if (plan.phases && plan.phases.length > 0) {
          const adaptiveResult = await adaptiveEngine.executePlan(goal, plan, {
            cwd: context.cwd,
            os: context.os,
            onPlanUpdate: (updatedPlan) => {
              this.emit({ type: 'plan', message: updatedPlan.summary, data: updatedPlan });
            },
            onPhaseStart: (phase) => {
              this.emit({ type: 'tool_start', message: `Phase ${phase.id}: ${phase.title}` });
            },
            onPhaseDone: (phase) => {
              const icon = phase.status === 'completed' ? '✓' : phase.status === 'skipped' ? '⊘' : phase.status === 'awaiting_action' ? '⏳' : '⚠';
              this.emit({ 
                type: 'tool_done', 
                message: `${icon} Phase ${phase.id}: ${phase.title}${phase.skippedReason ? ` (${phase.skippedReason})` : ''}` 
              });
            },
            onStepOutput: (output) => {
              this.emit({ type: 'step_output', message: output });
            },
            onPhysicalActionRequired: async (req) => {
              this.emit({ type: 'question', message: req.prompt, data: req });
              return true;
            },
            toolExecutor: this.toolExecutor,
            authorizationHandler: this.authorizationHandler
          });

          const lastStepWithData = [...adaptiveResult.steps].reverse().find(s => s.result?.data);
          this.emit({ 
            type: adaptiveResult.success ? 'done' : 'error', 
            message: adaptiveResult.summary,
            data: lastStepWithData?.result?.data
          });
          return {
            success: adaptiveResult.success,
            summary: adaptiveResult.summary,
            steps: adaptiveResult.steps.map(s => ({ tool: s.tool, params: s.params, result: s.result })),
            cdPath: adaptiveResult.cdPath
          };
        }
      }
    }

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
        let parsed = this.parseLLMResponse(response.content);
        if (!parsed) {
          // Try heuristic fallback first
          const fallback = this.tryHeuristicFallback(goal, context);
          if (fallback) {
            return await this.executeFallback(fallback, context);
          }

          // If the model responded with plain natural language, treat as conversation answer
          if (response.content && response.content.trim()) {
            const cleanText = response.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            if (cleanText) {
              parsed = { action: 'done', summary: cleanText };
            }
          }

          if (!parsed) {
            this.emit({ type: 'error', message: 'Could not understand the instruction' });
            return {
              success: false,
              summary: 'AI could not understand the instruction. Try rephrasing.',
              steps
            };
          }
        }

        // Handle actions
        if (parsed.action === 'done') {
          let summary = (parsed.summary || '').trim();
          if (!summary || (summary.startsWith('{') && summary.endsWith('}')) || summary === 'Done') {
            const fallback = this.tryHeuristicFallback(goal, context);
            if (fallback && steps.length === 0) {
              return await this.executeFallback(fallback, context);
            }
            summary = "Hey! I'm Sentinel, your AI terminal assistant. I can manage Wi-Fi, Bluetooth, navigate folders, inspect hardware/battery, run tools, and execute terminal commands.";
          }
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
          let params = parsed.params || {};

          // Validate and type-coerce parameters against tool schema
          const toolSpec = this.toolSpecs.find(t => t.id === toolId);
          const validation = ToolParameterValidator.validateAndCoerce(toolSpec, params);
          if (!validation.valid && validation.errors) {
            messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
            messages.push({ role: 'user', content: `Parameter error: ${validation.errors.join(', ')}. Please correct parameters.` });
            continue;
          }
          params = validation.coercedParams;

          // Check if tool exists
          if (!this.toolExecutor.hasDriver(toolId)) {
            // Tell the LLM the tool doesn't exist so it can try another
            messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
            messages.push({ role: 'user', content: `Error: Tool "${toolId}" not found. Available tools: ${this.toolSpecs.map(t => t.id).join(', ')}. Try a different tool.` });
            continue;
          }

          this.emit({ type: 'tool_start', message: this.getToolDisplayName(toolId) });

          // Execute the tool
          const result = await this.toolExecutor.execute(toolId, params, context.cwd, this.authorizationHandler);

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

  private createAgentPlan(summary: string, steps: string[], question?: string): AgentPlan {
    const phases: PlanPhase[] = steps.map((s, idx) => ({
      id: String(idx + 1),
      title: s,
      status: 'pending',
      dependencies: idx === 0 ? [] : [String(idx)]
    }));
    return {
      summary,
      steps,
      phases,
      question
    };
  }

  /**
   * Fast, deterministic workflow decomposition for common multi-step tasks and
   * instant clarification questions for ambiguous goals.
   */
  public tryHeuristicPlan(goal: string): AgentPlan | null {
    const lower = goal.toLowerCase().trim();

    // 1. Ambiguous goals requiring immediate clarification
    if (/^(?:connect\s+bluetooth|pair\s+bluetooth|bluetooth\s+connect|pair\s+device)\s*$/i.test(lower)) {
      return this.createAgentPlan('Bluetooth device connection', [], 'Which Bluetooth device would you like to connect to?');
    }

    if (/^(?:kill|terminate|stop|force\s+quit)\s+(?:process|app|application)?\s*$/i.test(lower)) {
      return this.createAgentPlan('Process termination', [], 'Which application or process name would you like to terminate?');
    }

    if (/^(?:git\s+checkout|checkout\s+branch|switch\s+branch|switch\s+to\s+branch)\s*$/i.test(lower)) {
      return this.createAgentPlan('Git branch switch', [], 'Which Git branch would you like to switch to?');
    }

    if (/^(?:scaffold|init|bootstrap|create\s+project|new\s+project)\s*$/i.test(lower)) {
      return this.createAgentPlan('Fullstack project scaffold', [], 'What stack would you like to scaffold (e.g., Next.js frontend, Express/Django backend)?');
    }

    if (/^(?:open|launch|start|run)\s+(?:the\s+|an?\s+)?(?:application|app)\s*$/i.test(lower)) {
      return this.createAgentPlan('Open desktop application', [], 'Which application would you like to open (e.g. Safari, Chrome, VS Code, Sentinel Terminal)?');
    }

    // 2. Concrete Multi-Step Workflows
    // Build & launch workflow
    if ((lower.includes('build') || lower.includes('compile')) && lower.includes('open')) {
      return this.createAgentPlan('Build and launch application bundle', [
        'Compile frontend assets and native binary',
        'Locate packaged application bundle and release artifacts',
        'Launch application in desktop environment',
        'Open release build folder in Finder'
      ]);
    }
    // Bluetooth connection workflow with target
    if (lower.includes('bluetooth') && (lower.includes('connect') || lower.includes('pair'))) {
      const rawTarget = goal.replace(/^.*(?:connect|pair)(?:\s+to)?\s+(?:the\s+)?(?:bluetooth\s+)?(?:device\s+)?/i, '').trim();
      const target = rawTarget && rawTarget.toLowerCase() !== 'bluetooth' ? rawTarget : 'device';
      return this.createAgentPlan(`Connect to Bluetooth device "${target}"`, [
        'Verify Bluetooth adapter power state',
        'Enable Bluetooth radio if currently disabled',
        'Scan for active Bluetooth peripherals in range',
        `Locate and establish connection with "${target}"`
      ]);
    }

    // Scaffolding workflow
    if (lower.includes('scaffold') || (lower.includes('create') && lower.includes('project')) || (lower.includes('init') && (lower.includes('next') || lower.includes('react')))) {
      return this.createAgentPlan('Scaffold project environment', [
        'Create target project directory structure',
        'Initialize frontend application scaffold',
        'Initialize backend service framework',
        'Configure dependencies and environment'
      ]);
    }

    // Git sync workflow
    if ((lower.includes('git') || lower.includes('repo')) && (lower.includes('sync') || (lower.includes('pull') && lower.includes('push')) || (lower.includes('commit') && lower.includes('push')))) {
      return this.createAgentPlan('Synchronize Git repository with remote', [
        'Inspect working tree status and modified files',
        'Pull upstream changes from remote branch',
        'Stage and commit local modifications',
        'Push commit history to origin'
      ]);
    }

    // Network diagnostic workflow
    if (lower.includes('diagnos') || (lower.includes('troubleshoot') && lower.includes('network')) || (lower.includes('test') && lower.includes('latency') && lower.includes('ping'))) {
      return this.createAgentPlan('Comprehensive network & connectivity diagnostic', [
        'Probe active network interfaces and IP allocation',
        'Measure ICMP packet reachability and latency to gateway',
        'Audit open listening TCP/UDP ports for conflicts'
      ]);
    }

    // System troubleshooting workflow
    if (lower.includes('troubleshoot') || lower.includes('system stuck') || lower.includes('system slow') || (lower.includes('check') && lower.includes('cpu') && lower.includes('memory') && lower.includes('processes'))) {
      return this.createAgentPlan('System resource and performance triage', [
        'Inspect system CPU load, memory pressure, and uptime',
        'Identify top resource-consuming background processes',
        'Check available APFS disk and volume storage'
      ]);
    }

    return null;
  }

  /**
   * Ask for only an operational outline. This deliberately avoids exposing or
   * retaining chain-of-thought while still giving a small model a stable plan.
   */
  private async createPlan(
    goal: string,
    context: { os: string; cwd: string },
    provider: ReturnType<ModelManager['getActiveProvider']>,
    modelId: string
  ): Promise<AgentPlan | null> {
    this.emit({ type: 'thinking', message: 'Planning the workflow...' });

    // 1. Check fast deterministic heuristic plan first
    const heuristicPlan = this.tryHeuristicPlan(goal);
    if (heuristicPlan) {
      return heuristicPlan;
    }

    // 2. Fallback to compact LLM planner
    try {
      const response = await provider.generate(this.buildPlanningPrompt(goal, context), modelId, {
        temperature: 0,
        maxTokens: 220,
        format: 'json'
      });
      return this.parsePlan(response.content);
    } catch {
      // Planning is an enhancement. A transient planning failure must not make
      // an otherwise executable request unusable.
      return null;
    }
  }

  private buildPlanningPrompt(goal: string, context: { os: string; cwd: string }): string {
    return `You are Sentinel's workflow planner on ${context.os}. Current directory: ${context.cwd}

Return ONLY one JSON object with this exact shape:
{"decision":"plan"|"clarify","summary":"short outcome","steps":["short concrete step"],"question":"only when clarification is required"}

Rules:
- Make 2 to 6 precise, user-visible steps. Do not expose private reasoning.
- Do not invent paths, package names, credentials, deployment targets, or destructive choices.
- If a missing detail prevents safe execution, use decision "clarify", include the one most important question, and use an empty steps array.
- Otherwise use decision "plan" and no question.
- A plan describes the work; it does not execute commands.

User request: ${goal}`;
  }

  private parsePlan(content: string): AgentPlan | null {
    if (!content) return null;
    const clean = content.replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      try {
        parsed = JSON.parse(clean.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    if (!parsed || (parsed.decision !== 'plan' && parsed.decision !== 'clarify')) return null;
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 180) : 'Workflow plan ready';
    const question = typeof parsed.question === 'string' ? parsed.question.trim().slice(0, 240) : undefined;
    const steps = Array.isArray(parsed.steps)
      ? (parsed.steps as unknown[])
        .map((step: unknown) => typeof step === 'string' ? step.trim() : '')
        .filter((step: string): step is string => step.length > 0)
        .slice(0, 6)
        .map((step: string) => step.slice(0, 180))
      : [];

    if (parsed.decision === 'clarify') {
      return question ? this.createAgentPlan(summary, [], question) : null;
    }
    return steps.length > 0 ? this.createAgentPlan(summary, steps) : null;
  }

  /**
   * Parse LLM JSON response, handling malformed output, thinking tokens, and code blocks gracefully.
   */
  private parseLLMResponse(content: string): LLMResponse | null {
    if (!content) return null;
    
    // Strip thinking tags if generated by reasoning models
    let clean = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // Strip markdown code fences
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const normalizeParsed = (obj: any): LLMResponse | null => {
      if (!obj || typeof obj !== 'object') return null;
      if (!obj.action) {
        if (obj.tool) obj.action = 'tool';
        else if (obj.summary || obj.response || obj.message || obj.result) obj.action = 'done';
      }
      if (obj.action === 'tool' || obj.action === 'done' || obj.action === 'error') {
        return obj as LLMResponse;
      }
      return null;
    };

    // 1. Try direct parse
    try {
      const parsed = normalizeParsed(JSON.parse(clean));
      if (parsed) return parsed;
    } catch { /* fall through */ }

    // 2. Fallback: Find the first complete JSON object using brace counting
    const startIndex = clean.indexOf('{');
    if (startIndex !== -1) {
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      
      for (let i = startIndex; i < clean.length; i++) {
        const char = clean[i];
        
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
            const jsonStr = clean.substring(startIndex, i + 1);
            try {
              const parsed = normalizeParsed(JSON.parse(jsonStr));
              if (parsed) return parsed;
            } catch {
              // Failed to parse extracted block
            }
            break;
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

    // Processes & CPU / Memory consuming tasks
    if (lower.includes('process') || lower.includes('processes') || lower.includes('top cpu') || lower.includes('most cpu') || lower.includes('high cpu') || lower.includes('eating cpu') || lower.includes('consuming cpu') || lower.includes('most ram') || lower.includes('high ram')) {
      if ((lower.includes('kill') || lower.includes('stop') || lower.includes('terminate') || lower.includes('force quit')) && !lower.includes('show') && !lower.includes('list') && !lower.includes('which') && !lower.includes('what')) {
        let target = goal.replace(/^.*(?:kill|stop|terminate|force\s+quit)\s+/i, '').replace(/\s+(?:process|app|application).*$/i, '').trim();
        if (target.toLowerCase() === 'vs code') target = 'Visual Studio Code';
        if (target.toLowerCase().includes('antigrav')) target = 'Antigravity IDE';
        if (target) return { tool: 'system.kill_process', params: { process: target } };
      }
      return { tool: 'system.processes', params: { sort: lower.includes('ram') || lower.includes('memory') ? 'ram' : 'cpu' } };
    }

    // Network Utilities: Ping, Ports, Interfaces, DNS, IP
    if (lower.includes('ping') || lower.includes('latency')) {
      const hostMatch = lower.match(/(?:ping|latency\s+to)\s+([a-z0-9_.-]+)/i);
      const host = hostMatch && hostMatch[1] ? hostMatch[1].trim() : 'google.com';
      return { tool: 'network.ping', params: { host } };
    }

    if (lower.includes('port') || lower.includes('ports') || lower.includes('listening')) {
      const portMatch = lower.match(/(?:port|listening\s+on)\s*:?\s*(\d+)/i);
      const port = portMatch && portMatch[1] ? parseInt(portMatch[1], 10) : undefined;
      return { tool: 'network.ports', params: port ? { port } : {} };
    }

    // System info & Storage
    if (lower.includes('battery')) return { tool: 'system.battery', params: {} };
    if (lower.includes('disk') || lower.includes('storage') || lower.includes('free space') || lower.includes('disk space')) return { tool: 'system.storage', params: {} };
    if (lower.includes('system info') || lower.includes('specs') || lower.includes('hardware info') || lower.includes('cpu') || lower.includes('ram') || lower.includes('uptime')) return { tool: 'system.info', params: {} };

    // System Services (systemctl / launchctl / Windows Services)
    if (lower.includes('service') && (lower.includes('status') || lower.includes('start') || lower.includes('stop') || lower.includes('restart') || lower.includes('enable') || lower.includes('disable'))) {
      const actMatch = lower.match(/(start|stop|restart|enable|disable|status)/);
      const action = actMatch ? actMatch[1] : 'status';
      const svcMatch = lower.match(/(?:service\s+([a-z0-9_.-]+)|([a-z0-9_.-]+)\s+service)/i);
      const service = svcMatch ? (svcMatch[1] || svcMatch[2]) : '';
      if (service) {
        return { tool: 'system.service', params: { service, action } };
      }
    }

    // Dotfile Rice and Autostart
    if (lower.includes('rice') || lower.includes('autostart') || lower.includes('hyprland') || lower.includes('i3')) {
      const toggleMatch = lower.match(/(?:turn\s+(on|off)|enable|disable)\s+([a-z0-9_.-]+)/i);
      if (toggleMatch) {
        const enable = toggleMatch[1] === 'on' || lower.includes('enable');
        const app = toggleMatch[2].trim();
        const target = lower.includes('i3') ? 'i3' : lower.includes('sway') ? 'sway' : 'hyprland';
        return { tool: 'system.dotfile', params: { app, enable, target } };
      }
    }

    // System Operations
    if (lower.includes('lock') && (lower.includes('mac') || lower.includes('screen') || lower.includes('laptop') || lower.includes('computer'))) {
      return { tool: 'system.lock', params: {} };
    }

    // Git commands
    if (lower.includes('git status') || lower.includes('branch status')) {
      return { tool: 'git.status', params: {} };
    }
    if (lower.includes('git log') || lower.includes('commits') || lower.includes('commit history')) {
      return { tool: 'git.log', params: {} };
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

    // Filesystem search (e.g. find all json files in tools directory, search for *.ts in src)
    if (lower.startsWith('find ') || lower.startsWith('search ') || lower.startsWith('locate ') || lower.includes('find all') || lower.includes('search for') || lower.includes('locate files')) {
      let pattern = '*';
      let dir = '.';

      const dirMatch = lower.match(/\s+(?:in|under|inside)\s+([~/a-z0-9_.-]+)/i);
      if (dirMatch && dirMatch[1]) {
        dir = dirMatch[1].replace(/^(?:the|a|an)\s+/i, '').replace(/\s*(?:directory|folder|dir)$/i, '').trim();
      }

      const extMatch = lower.match(/\b([a-z0-9_-]+)\s+files?\b/i);
      if (extMatch && extMatch[1] && !['all', 'the', 'some', 'any', 'my', 'locate', 'search', 'find'].includes(extMatch[1])) {
        pattern = `*.${extMatch[1]}`;
      } else {
        const namedMatch = lower.match(/(?:named|with\s+name|matching|for)\s+['"]?([a-z0-9_.*-]+)['"]?/i);
        if (namedMatch && namedMatch[1]) {
          pattern = namedMatch[1].trim();
        }
      }

      return { tool: 'filesystem.search', params: { dir, pattern } };
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
    const result = await this.toolExecutor.execute(fallback.tool, fallback.params, context.cwd, this.authorizationHandler);
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
      case 'system.service': return `✓ Service ${params.service} ${params.action} completed`;
      case 'system.dotfile': return `✓ Dotfile autostart for ${params.app} ${params.enable !== false ? 'enabled' : 'disabled'}`;
      default: return `✓ ${toolId.replace(/\./g, ' ')} completed`;
    }
  }

  /**
   * Get a human-friendly display name for a tool.
   */
  private getToolDisplayName(toolId: string): string {
    const names: Record<string, string> = {
      'system.service': 'Managing system service...',
      'system.dotfile': 'Updating dotfile configuration...',
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
   * Truncate large data objects before feeding back to LLM to save tokens
   * and protect small models from context window overflow.
   */
  private truncateData(data: any): any {
    if (!data) return data;
    if (typeof data !== 'object') return data;

    // Compact arrays (e.g. file listings, process lists, scan results)
    if (Array.isArray(data)) {
      if (data.length > 5) {
        return {
          totalCount: data.length,
          sample: data.slice(0, 5),
          truncated: true
        };
      }
      return data;
    }

    const truncated: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string') {
        truncated[k] = v.length > 250 ? v.substring(0, 250) + '... (truncated)' : v;
      } else if (Array.isArray(v)) {
        truncated[k] = v.length > 5 ? { count: v.length, sample: v.slice(0, 5) } : v;
      } else if (typeof v === 'object' && v !== null) {
        truncated[k] = JSON.stringify(v).length > 300 ? '[Complex Object]' : v;
      } else {
        truncated[k] = v;
      }
    }
    return truncated;
  }
}
