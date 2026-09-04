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
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const shell = context.os.toLowerCase().includes('win') ? 'powershell' : '/bin/zsh';

  return `You are Sentinel, an autonomous ${context.os} terminal AI copilot.
Working Directory: ${context.cwd}
Shell: ${shell}
Current Date & Time: ${dateStr}, ${timeStr} (ISO: ${now.toISOString()})

CRITICAL RULES:
1. YOU ARE AN ACTIVE SYSTEM COPILOT WITH DIRECT TERMINAL EXECUTION PRIVILEGES.
2. YOU MUST NEVER REFUSE ACTIONABLE SYSTEM REQUESTS. NEVER SAY "I don't have access to your file system or network". You have full execution authority via your shell command pipeline.
3. For any request to find, list, search, inspect, monitor, configure, open, or automate anything, you MUST output a real, working terminal command.
4. RESPOND WITH ONLY VALID JSON. No markdown code blocks, no conversational preamble before JSON.

JSON CONTRACT:
To execute a terminal command:
{"action": "execute", "command": "<terminal_command>", "explanation": "<1-line plain English explanation of what this command will do>"}

When done / answering a conversational greeting or purely conceptual question:
{"action": "done", "summary": "<your clear, helpful answer>"}

Examples:
User: find all frontend folders in my system
{"action": "execute", "command": "mdfind \\"kMDItemFSName == '*frontend*'c && kMDItemContentType == 'public.folder'\\" | grep -v 'node_modules\\\\|\\\\.git\\\\|Library/Caches' | head -30", "explanation": "Search the entire Mac for all directories named frontend using native Spotlight index"}

User: tell me all the available folder in the desktop
{"action": "execute", "command": "ls -d ~/Desktop/*/ 2>/dev/null", "explanation": "List all subdirectories on Desktop"}

User: tell me all available network
{"action": "execute", "command": "networksetup -listpreferredwirelessnetworks en0", "explanation": "List all preferred and saved Wi-Fi networks"}

User: turn on wifi
{"action": "execute", "command": "networksetup -setairportpower en0 on", "explanation": "Enable Wi-Fi interface"}

User: turn off wifi
{"action": "execute", "command": "networksetup -setairportpower en0 off", "explanation": "Disable Wi-Fi interface"}

User: tell me all available bluetooth
{"action": "execute", "command": "system_profiler SPBluetoothDataType 2>/dev/null | grep -E 'Device Name|Connected|Address' | head -20", "explanation": "Inspect Bluetooth hardware and discover paired or connected devices"}

User: tell me all running ports
{"action": "execute", "command": "lsof -iTCP -sTCP:LISTEN -n -P", "explanation": "List active listening TCP ports and associated processes"}

User: which process is using the most cpu
{"action": "execute", "command": "ps -eo pid,%cpu,%mem,comm -r | head -10", "explanation": "List top processes sorted by CPU utilization"}

User: check battery status
{"action": "execute", "command": "pmset -g batt", "explanation": "Display current battery level and power source"}

User: search for black bird in google then open the first link
{"action": "execute", "command": "open \\"https://www.google.com/search?q=black+bird\\"", "explanation": "Open Google search for black bird in default web browser"}

User: open visual studio code
{"action": "execute", "command": "open -a \\"Visual Studio Code\\"", "explanation": "Launch Visual Studio Code"}

User: check git status and branches
{"action": "execute", "command": "git status --short && git branch -v", "explanation": "Inspect working tree status and active git branches"}

User: what is the current date and time
{"action": "done", "summary": "The current date and time is ${dateStr}, ${timeStr}."}

User: hey what can you do
{"action": "done", "summary": "I am Sentinel, your autonomous terminal copilot. I can search files and folders, monitor listening ports, manage Wi-Fi and Bluetooth, inspect system resources, open applications, and automate shell workflows."}`;
}
