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

/**
 * Build a compact tool listing from the registry for the LLM prompt.
 * Only includes the most commonly used tools to keep the prompt small.
 */
export function buildToolSpecs(registry: ToolRegistryState): ToolSpec[] {
  const tools = registry.toolIndex.getAll();
  return tools.map(t => ({
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

  return `You are Sentinel, a ${context.os} terminal AI. CWD: ${context.cwd}

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
- Prefer a specialized tool when one clearly fits. For any installed macOS command, shell built-in, developer CLI, pipe, redirect, or compound terminal task that has no specialized tool, use shell.execute with the complete zsh command line in params.command.
- Never use shell.execute to bypass permissions. Commands that change files, processes, network settings, disks, or privileges will request user approval before running.

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
