/**
 * SystemPrompt.ts — Dynamic System Prompt Builder for LLM Agent Loop
 * 
 * Generates a system prompt that includes all available tools from the registry,
 * formatted so the LLM can decide which tool to call and with what parameters.
 */

import { ToolRegistryState } from '../../tools/loader/ToolLoader';
import { DynamicToolPruner } from './DynamicToolPruner';

export interface ToolSpec {
  id: string;
  name: string;
  description: string;
  parameters: { name: string; type: string; required: boolean; description: string }[];
}

export const STANDARD_TOOL_SPECS: ToolSpec[] = [
  {
    id: 'filesystem.search',
    name: 'Search Files & Folders',
    description: 'Find files or folders by name, pattern, or path across the system or workspace.',
    parameters: [
      { name: 'pattern', type: 'string', required: true, description: 'File/folder name or glob pattern to search for' },
      { name: 'dir', type: 'string', required: false, description: 'Starting directory (default ~ for user system)' },
      { name: 'type', type: 'string', required: false, description: '"directory" to find folders, or "file"' }
    ]
  },
  {
    id: 'filesystem.list',
    name: 'List Directory',
    description: 'List contents of a directory.',
    parameters: [
      { name: 'path', type: 'string', required: false, description: 'Directory path (defaults to current dir)' }
    ]
  },
  {
    id: 'filesystem.read',
    name: 'Read File',
    description: 'Read content of a text file.',
    parameters: [
      { name: 'path', type: 'string', required: true, description: 'Path to file' }
    ]
  },
  {
    id: 'filesystem.navigate',
    name: 'Navigate Directory',
    description: 'Change current working directory (cd).',
    parameters: [
      { name: 'path', type: 'string', required: true, description: 'Target directory path' }
    ]
  },
  {
    id: 'network.wifi.scan',
    name: 'Scan Wi-Fi Networks',
    description: 'List all available and previously connected Wi-Fi networks.',
    parameters: []
  },
  {
    id: 'network.wifi.on',
    name: 'Turn On Wi-Fi',
    description: 'Enable the Wi-Fi interface.',
    parameters: []
  },
  {
    id: 'network.wifi.off',
    name: 'Turn Off Wi-Fi',
    description: 'Disable the Wi-Fi interface.',
    parameters: []
  },
  {
    id: 'network.wifi.connect',
    name: 'Connect Wi-Fi',
    description: 'Connect to a Wi-Fi network.',
    parameters: [
      { name: 'ssid', type: 'string', required: true, description: 'Wi-Fi network name' },
      { name: 'password', type: 'string', required: false, description: 'Network password' }
    ]
  },
  {
    id: 'network.bluetooth.list',
    name: 'List Bluetooth Devices',
    description: 'Scan and list available or paired Bluetooth devices.',
    parameters: []
  },
  {
    id: 'network.bluetooth.on',
    name: 'Turn On Bluetooth',
    description: 'Enable Bluetooth adapter.',
    parameters: []
  },
  {
    id: 'network.bluetooth.off',
    name: 'Turn Off Bluetooth',
    description: 'Disable Bluetooth adapter.',
    parameters: []
  },
  {
    id: 'network.bluetooth.connect',
    name: 'Connect Bluetooth Device',
    description: 'Connect to a Bluetooth device.',
    parameters: [
      { name: 'device', type: 'string', required: true, description: 'Device name or MAC address' }
    ]
  },
  {
    id: 'network.ports',
    name: 'List Open Ports',
    description: 'Inspect active listening ports and their associated processes.',
    parameters: [
      { name: 'port', type: 'number', required: false, description: 'Specific port to check' }
    ]
  },
  {
    id: 'network.ping',
    name: 'Ping Host',
    description: 'Check network connectivity to a host or IP.',
    parameters: [
      { name: 'host', type: 'string', required: true, description: 'Hostname or IP address' }
    ]
  },
  {
    id: 'system.processes',
    name: 'List Processes',
    description: 'List running processes sorted by CPU or RAM usage.',
    parameters: [
      { name: 'sort', type: 'string', required: false, description: '"cpu" or "ram"' }
    ]
  },
  {
    id: 'system.storage',
    name: 'Check Storage',
    description: 'Check available and used disk space.',
    parameters: []
  },
  {
    id: 'system.battery',
    name: 'Check Battery',
    description: 'Check battery percentage and charging state.',
    parameters: []
  },
  {
    id: 'system.info',
    name: 'System Info',
    description: 'Get OS, architecture, and hardware information.',
    parameters: []
  },
  {
    id: 'application.open',
    name: 'Open Application',
    description: 'Launch or open a desktop application.',
    parameters: [
      { name: 'app', type: 'string', required: true, description: 'Application name (e.g. "Visual Studio Code", "Chrome", "Safari")' }
    ]
  },
  {
    id: 'browser.search',
    name: 'Web Search',
    description: 'Search the web using default browser.',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Search keywords' },
      { name: 'engine', type: 'string', required: false, description: 'Search engine (default: "google")' }
    ]
  },
  {
    id: 'browser.navigate',
    name: 'Open URL',
    description: 'Open a URL in default browser.',
    parameters: [
      { name: 'url', type: 'string', required: true, description: 'Website URL' }
    ]
  },
  {
    id: 'git.status',
    name: 'Git Status',
    description: 'Show working tree status.',
    parameters: []
  },
  {
    id: 'git.log',
    name: 'Git Log',
    description: 'Show recent commits.',
    parameters: []
  },
  {
    id: 'shell.execute',
    name: 'Execute Shell Command',
    description: 'Run arbitrary shell command with explanation.',
    parameters: [
      { name: 'command', type: 'string', required: true, description: 'Shell command string' },
      { name: 'explanation', type: 'string', required: false, description: 'Plain English explanation of what this command does' }
    ]
  }
];

/**
 * Build a compact tool listing from the registry for the LLM prompt.
 * Merges standard built-in tools with any dynamically loaded tools.
 */
export function buildToolSpecs(registry?: ToolRegistryState): ToolSpec[] {
  const tools = registry?.toolIndex?.getAll?.() || [];
  if (!tools || tools.length === 0) {
    return STANDARD_TOOL_SPECS;
  }
  const loaded: ToolSpec[] = tools.map(t => ({
    id: t.definition.id,
    name: t.definition.displayName,
    description: t.definition.description.split('.')[0] || t.definition.description,
    parameters: (t.definition.parameters || []).map(p => ({
      name: p.name,
      type: p.type || 'string',
      required: p.required ?? false,
      description: p.description || ''
    }))
  }));

  const loadedIds = new Set(loaded.map(t => t.id));
  const merged: ToolSpec[] = [...loaded];
  for (const std of STANDARD_TOOL_SPECS) {
    if (!loadedIds.has(std.id)) {
      merged.push(std);
    }
  }
  return merged;
}

/**
 * Build the system prompt for the agentic ReAct loop.
 * If goal is provided, dynamically prunes tools down to the 4-6 most relevant tools.
 */
export function buildSystemPrompt(
  toolSpecs: ToolSpec[],
  context: { os: string; cwd: string },
  goal?: string,
  options?: { maxTools?: number }
): string {
  const maxTools = options?.maxTools ?? 6;
  // Dynamic Small-Model Tool Pruning
  const activeTools = goal
    ? DynamicToolPruner.prune(toolSpecs, goal, { maxTools })
    : toolSpecs.filter(t => ['filesystem.', 'system.', 'network.', 'application.', 'browser.', 'git.', 'developer.', 'shell.'].some(p => t.id.startsWith(p)));

  const toolList = activeTools.map(t => {
    const params = t.parameters
      .map(p => `${p.name}${p.required ? '*' : ''}`)
      .join(', ');
    return `- ${t.id}(${params}): ${t.description}`;
  }).join('\n');

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return `You are Sentinel, an autonomous ${context.os} terminal AI copilot. CWD: ${context.cwd}
Current System Date & Time: ${dateStr}, ${timeStr} (ISO: ${now.toISOString()})

RESPOND WITH ONLY VALID JSON. No other text.

To use a tool: {"action":"tool","tool":"<id>","params":{<params>}}
When done: {"action":"done","summary":"<what happened>"}
On error: {"action":"error","message":"<reason>"}

For conversational questions (greetings, "what can you do", etc):
{"action":"done","summary":"<your friendly answer>"}

Rules:
- ONE tool per response
- Think step by step for multi-step tasks
- NEVER hallucinate paths like "YourUsername", "/path/to", or "Project Folder". If the user asks for a file/folder but doesn't give the absolute path, you MUST use a tool (like filesystem.search or locate_folders) to find it first.
- If an app name isn't recognized, use filesystem.search to find the .app in /Applications.
- If bluetooth connect is asked: turn on bluetooth first, then scan, then connect
- Prefer a specialized tool when one clearly fits. For any command or task that has no specialized tool (e.g. ffmpeg, tar, jq, curl, rustc, build tools), use shell.execute with params: {"command": "<command>", "explanation": "<1-line plain English explanation of what this command will do without jargon>"}.
- Never use shell.execute to bypass permissions. Non-read-only commands will prompt the user for approval with your 1-line explanation before executing.

Tools:
${toolList}

Examples:
User: turn on bluetooth → {"action":"tool","tool":"network.bluetooth.on","params":{}}
User: which process is using the most CPU → {"action":"tool","tool":"system.processes","params":{"sort":"cpu"}}
User: check available disk space → {"action":"tool","tool":"system.storage","params":{}}
User: check if port 3000 is open → {"action":"tool","tool":"network.ports","params":{"port":3000}}
User: ping google.com → {"action":"tool","tool":"network.ping","params":{"host":"google.com"}}
User: check git status and recent commits → {"action":"tool","tool":"git.status","params":{}}
User: find all json files in tools → {"action":"tool","tool":"filesystem.search","params":{"dir":"tools","pattern":"*.json"}}
User: show the current directory and its git branch → {"action":"tool","tool":"shell.execute","params":{"command":"pwd && git branch --show-current"}}
User: find the ten largest files here → {"action":"tool","tool":"shell.execute","params":{"command":"find . -type f -print0 | xargs -0 du -h | sort -hr | head -10"}}
User: make a folder and init nextjs and django → {"action":"tool","tool":"developer.scaffold","params":{"frontend":"nextjs","backend":"django","projectName":"my_project"}}
User: go to downloads → {"action":"tool","tool":"filesystem.navigate","params":{"path":"~/Downloads"}}
User: open youtube.com in safari → {"action":"tool","tool":"browser.navigate","params":{"url":"youtube.com","appName":"Safari"}}
User: kill chrome → {"action":"tool","tool":"system.kill_process","params":{"process":"Google Chrome"}}
User: hey there → {"action":"done","summary":"Hey! I'm Sentinel, your AI terminal assistant. I can control bluetooth, wifi, navigate files, open apps, and more. Just tell me what you need!"}`;
}
