/**
 * SystemPrompt.ts — Dynamic System Prompt Builder for LLM Agent Loop
 * 
 * Generates a system prompt that includes all available tools from the registry,
 * formatted so the LLM can decide which tool to call and with what parameters.
 */

import { ToolRegistryState } from '../../tools/loader/ToolLoader';

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
  const tools = registry?.toolIndex?.getAll ? registry.toolIndex.getAll() : [];
  return tools.map(t => ({
    id: t.definition.id,
    name: t.definition.displayName,
    description: t.definition.description,
    parameters: t.definition.parameters.map(p => ({
      name: p.name,
      type: p.type || 'string',
      required: p.required ?? false,
      description: p.description || ''
    }))
  }));
}

/**
 * Build the system prompt for the agentic ReAct loop.
 */
export function buildSystemPrompt(toolSpecs: ToolSpec[], context: { os: string; cwd: string }): string {
  // Build a compact tool listing — only id and brief description to save tokens
  const toolList = toolSpecs.map(t => {
    const params = t.parameters
      .filter(p => p.required)
      .map(p => `${p.name}:${p.type}`)
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

Tools:
${toolList}

Examples:
User: turn on bluetooth → {"action":"tool","tool":"network.bluetooth.on","params":{}}
User: make a folder and init nextjs and django → {"action":"tool","tool":"developer.scaffold","params":{"frontend":"nextjs","backend":"django","projectName":"my_project"}}
User: go to downloads → {"action":"tool","tool":"filesystem.navigate","params":{"path":"~/Downloads"}}
User: kill chrome → {"action":"tool","tool":"system.kill_process","params":{"process":"Google Chrome"}}
User: hey there → {"action":"done","summary":"Hey! I'm Sentinel, your AI terminal assistant. I can control bluetooth, wifi, navigate files, open apps, and more. Just tell me what you need!"}`;
}
