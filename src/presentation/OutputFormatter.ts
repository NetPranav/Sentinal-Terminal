/**
 * OutputFormatter.ts — Clean Terminal Output for Agent Events
 * 
 * Converts agent events into clean, minimal ANSI terminal output.
 * No debug spam, no confidence percentages, no tool IDs.
 * Just clean, human-readable messages.
 */

// ANSI color codes
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  boldGreen: '\x1b[1;32m',
  boldCyan: '\x1b[1;36m',
  boldRed: '\x1b[1;31m',
  boldYellow: '\x1b[1;33m',
};

export interface AgentEventFormatted {
  type: 'thinking' | 'plan' | 'question' | 'tool_start' | 'tool_done' | 'done' | 'error' | 'step_output';
  message: string;
  data?: any;
}

/**
 * Format an agent event into a clean terminal string.
 */
export function formatAgentEvent(event: AgentEventFormatted): string {
  switch (event.type) {
    case 'thinking':
      return `\r\n${C.dim}${C.cyan}● ${event.message}${C.reset}\r\n`;

    case 'plan':
      // The interactive execution plan is presented via the floating HUD dropdown in the UI.
      // Do not duplicate or dump multi-line ASCII blocks into the main terminal buffer.
      return '';

    case 'question':
      return `\r\n${C.boldYellow}  ? ${event.message}${C.reset}\r\n${C.dim}  Type your answer to continue, or /cancel to stop this workflow.${C.reset}\r\n`;

    case 'tool_start':
      return `${C.dim}${C.white}  ▸ ${event.message}${C.reset}\r\n`;

    case 'tool_done':
      if (event.message.startsWith('✓')) {
        return `${C.green}  ${event.message}${C.reset}\r\n`;
      } else if (event.message.startsWith('⚠')) {
        return `${C.yellow}  ${event.message}${C.reset}\r\n`;
      }
      return `${C.white}  ${event.message}${C.reset}\r\n`;

    case 'done':
      return `${C.boldGreen}  ${event.message}${C.reset}\r\n`;

    case 'error':
      return `${C.boldRed}  ✗ ${event.message}${C.reset}\r\n`;

    case 'step_output':
      return `${C.white}${event.message}${C.reset}\r\n`;

    default:
      return `${event.message}\r\n`;
  }
}

/**
 * Format structured data (like file lists, device lists, etc.) for clean terminal display.
 */
export function formatDataOutput(data: any): string {
  if (!data) return '';

  // File/directory listing
  if (data.entries && Array.isArray(data.entries)) {
    return formatFileList(data.entries);
  }
  if (data.files && Array.isArray(data.files)) {
    return formatFileList(data.files);
  }

  // Bluetooth devices
  if (data.devices && Array.isArray(data.devices)) {
    return formatDeviceList(data.devices);
  }

  // WiFi networks
  if (data.networks && Array.isArray(data.networks)) {
    return formatNetworkList(data.networks);
  }

  // Search results
  if (data.matches && Array.isArray(data.matches)) {
    return formatSearchResults(data.matches);
  }
  if (data.results && Array.isArray(data.results)) {
    return formatSearchResults(data.results);
  }

  // Process list
  if (data.processes && Array.isArray(data.processes)) {
    return formatProcessList(data.processes);
  }

  // Command stdout
  if (typeof data === 'object' && ('code' in data || 'stdout' in data)) {
    if (data.stdout && typeof data.stdout === 'string' && data.stdout.trim()) {
      return `\r\n${data.stdout.trim().replace(/\r?\n/g, '\r\n')}\r\n`;
    }
    return '';
  }

  // Generic object — show key-value pairs cleanly
  if (typeof data === 'object' && Object.keys(data).length > 0) {
    const skip = new Set(['commandExecuted', 'dryRun', 'rollbackPayload', 'stdout', 'stderr', 'code']);
    const lines = Object.entries(data)
      .filter(([k]) => !skip.has(k))
      .map(([k, v]) => {
        if (typeof v === 'object' && v !== null) return `  ${C.dim}${k}:${C.reset} ${JSON.stringify(v)}`;
        return `  ${C.dim}${k}:${C.reset} ${v}`;
      });
    if (lines.length > 0) {
      return `\r\n${lines.join('\r\n')}\r\n`;
    }
  }

  return '';
}

function formatFileList(files: any[]): string {
  if (files.length === 0) return `\r\n${C.dim}  (empty directory)${C.reset}\r\n`;
  
  const lines = files.slice(0, 50).map(f => {
    const name = typeof f === 'string' ? f : (f.name || f.path || String(f));
    const isDir = typeof f === 'object' && (f.isDirectory || f.type === 'directory');
    const icon = isDir ? '📁' : '📄';
    const size = typeof f === 'object' && f.size ? ` ${C.dim}(${formatSize(f.size)})${C.reset}` : '';
    return `  ${icon} ${isDir ? C.boldCyan : C.white}${name}${C.reset}${size}`;
  });

  if (files.length > 50) {
    lines.push(`${C.dim}  ... and ${files.length - 50} more${C.reset}`);
  }

  return `\r\n${lines.join('\r\n')}\r\n`;
}

function formatDeviceList(devices: any[]): string {
  if (devices.length === 0) return `\r\n${C.dim}  No devices found${C.reset}\r\n`;
  
  const lines = devices.map(d => {
    const name = d.name || d.address || String(d);
    const connected = d.connected ? `${C.green} (connected)${C.reset}` : '';
    const addr = d.address ? ` ${C.dim}${d.address}${C.reset}` : '';
    return `  🔵 ${C.white}${name}${C.reset}${addr}${connected}`;
  });

  return `\r\n${lines.join('\r\n')}\r\n`;
}

function formatNetworkList(networks: any[]): string {
  if (networks.length === 0) return `\r\n${C.dim}  No networks found${C.reset}\r\n`;
  
  const lines = networks.map(n => {
    const name = n.ssid || n.name || String(n);
    const signal = n.signal ? ` ${C.dim}(${n.signal})${C.reset}` : '';
    const secured = n.security ? ` 🔒` : '';
    return `  📶 ${C.white}${name}${C.reset}${signal}${secured}`;
  });

  return `\r\n${lines.join('\r\n')}\r\n`;
}

function formatSearchResults(results: any[]): string {
  if (results.length === 0) return `\r\n${C.dim}  No results found${C.reset}\r\n`;
  
  const lines = results.slice(0, 30).map(r => {
    const path = typeof r === 'string' ? r : (r.path || r.name || String(r));
    const isDir = typeof r === 'object'
      ? (r.isDirectory || r.type === 'directory')
      : (!path.split('/').pop()?.includes('.') || path.endsWith('/'));
    const icon = isDir ? '📁' : '📄';
    const color = isDir ? C.boldCyan : C.white;
    const size = typeof r === 'object' && r.size ? ` ${C.dim}(${formatSize(r.size)})${C.reset}` : '';
    return `  ${icon} ${color}${path}${C.reset}${size}`;
  });

  if (results.length > 30) {
    lines.push(`${C.dim}  ... and ${results.length - 30} more${C.reset}`);
  }

  return `\r\n${lines.join('\r\n')}\r\n`;
}

function formatProcessList(processes: any[]): string {
  if (processes.length === 0) return `\r\n${C.dim}  No processes found${C.reset}\r\n`;
  
  const lines = processes.slice(0, 30).map(p => {
    const name = p.name || p.command || String(p);
    const pid = p.pid ? ` ${C.dim}PID:${p.pid}${C.reset}` : '';
    const cpu = p.cpu ? ` ${C.dim}CPU:${p.cpu}%${C.reset}` : '';
    return `  ⚙ ${C.white}${name}${C.reset}${pid}${cpu}`;
  });

  return `\r\n${lines.join('\r\n')}\r\n`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
