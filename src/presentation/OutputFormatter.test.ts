import { describe, it, expect } from 'vitest';
import { formatAgentEvent, formatMarkdownTerminal, formatDataOutput } from './OutputFormatter';

describe('OutputFormatter — Terminal Markdown & CRLF Formatting', () => {
  it('formats multi-line markdown responses without any bare LF (staircase prevention)', () => {
    const markdown = `Yes, you can change your IP address on macOS by using the \`networksetup\` command. Here's how you can do it:

1. **Change Wi-Fi IP Address:**
\`\`\`sh
sudo networksetup -setmanual en0 192.168.1.100 255.255.255.0 192.168.1.1
\`\`\`
Replace \`en0\` with your Wi-Fi interface name.

2. **Change Ethernet IP Address:**
\`\`\`sh
sudo networksetup -setmanual en1 192.168.1.100 255.255.255.0 192.168.1.1
\`\`\`
`;

    const formatted = formatAgentEvent({ type: 'done', message: markdown });

    // Must not contain any bare LF (\n without preceding \r)
    expect(/(?<!\r)\n/.test(formatted)).toBe(false);

    // Every non-empty line should start with a 2-space margin
    const lines = formatted.split('\r\n').filter(l => Boolean(l.trim()));
    for (const line of lines) {
      expect(line.startsWith('  ')).toBe(true);
    }

    // Code blocks should be cleanly boxed
    expect(formatted).toContain('┌── sh ─');
    expect(formatted).toContain('│');
    expect(formatted).toContain('└──');
  });

  it('formats headers, lists, and inline code properly', () => {
    const sample = `### Network Setup
* Step 1: Run \`ifconfig\`
* Step 2: Check **active** interface`;

    const formatted = formatMarkdownTerminal(sample);
    expect(/(?<!\r)\n/.test(formatted)).toBe(false);
    expect(formatted).toContain('Network Setup');
    expect(formatted).toContain('•');
    expect(formatted).toContain('ifconfig');
    expect(formatted).toContain('active');
  });

  it('formats status events (thinking, tool_start, tool_done, error) with guaranteed CRLF', () => {
    const thinking = formatAgentEvent({ type: 'thinking', message: 'Analyzing configuration...' });
    expect(/(?<!\r)\n/.test(thinking)).toBe(false);
    expect(thinking.endsWith('\r\n')).toBe(true);

    const toolStart = formatAgentEvent({ type: 'tool_start', message: 'Running networksetup...' });
    expect(/(?<!\r)\n/.test(toolStart)).toBe(false);
    expect(toolStart.endsWith('\r\n')).toBe(true);

    const toolDone = formatAgentEvent({ type: 'tool_done', message: '✓ Network configured' });
    expect(/(?<!\r)\n/.test(toolDone)).toBe(false);
    expect(toolDone.endsWith('\r\n')).toBe(true);

    const error = formatAgentEvent({ type: 'error', message: 'Operation failed\nAccess denied' });
    expect(/(?<!\r)\n/.test(error)).toBe(false);
    expect(error.endsWith('\r\n')).toBe(true);
  });

  it('formats activeProcesses cleanly with PID, CPU%, and RAM%', () => {
    const out = formatDataOutput({
      sortedBy: 'cpu',
      activeProcesses: [
        { pid: 20485, name: 'spotify', cpuPercent: 19.7, ramPercent: 2.7 },
        { pid: 21581, name: 'WebKitWebProcess', cpuPercent: 10.3, ramPercent: 2.7 }
      ]
    });

    expect(out).toContain('Top Processes (sorted by CPU)');
    expect(out).toContain('spotify');
    expect(out).toContain('PID:20485');
    expect(out).toContain('CPU: 19.7%');
    expect(out).toContain('RAM: 2.7%');
    expect(/(?<!\r)\n/.test(out)).toBe(false);
  });

  it('formats storage volumes cleanly with mounts and free space', () => {
    const out = formatDataOutput({
      volumes: [
        { mount: '/', total: '261G', available: '64G', percentUsed: '75%', filesystem: '/dev/nvme0n1p6' }
      ]
    });

    expect(out).toContain('Storage Mounts & Disk Usage');
    expect(out).toContain('/dev/nvme0n1p6');
    expect(out).toContain('64G free');
    expect(out).toContain('of 261G');
    expect(out).toContain('75% used');
    expect(/(?<!\r)\n/.test(out)).toBe(false);
  });

  it('formats battery status and ram status cleanly', () => {
    const batOut = formatDataOutput({
      percentage: 58,
      status: 'Not charging',
      powerSource: 'Battery (BAT1)'
    });
    expect(batOut).toContain('Battery:');
    expect(batOut).toContain('58%');
    expect(batOut).toContain('Not charging');

    const ramOut = formatDataOutput({
      totalGb: 15.1,
      usedGb: 6.4,
      availableGb: 8.9,
      swapTotalGb: 7.7,
      swapUsedGb: 2.2
    });
    expect(ramOut).toContain('System Memory (RAM):');
    expect(ramOut).toContain('6.4 GB used');
    expect(ramOut).toContain('15.1 GB total');
  });

  it('formats single process card when singular query is requested', () => {
    const out = formatDataOutput({
      sortedBy: 'cpu',
      count: 1,
      singular: true,
      activeProcesses: [
        { pid: 52374, name: 'llama-server', cpuPercent: 196, ramPercent: 19.9 }
      ]
    });

    expect(out).toContain('▶ Top Process (sorted by CPU):');
    expect(out).toContain('llama-server');
    expect(out).toContain('PID:52374');
    expect(out).toContain('CPU: 196%');
    expect(out).toContain('RAM: 19.9%');
    expect(/(?<!\r)\n/.test(out)).toBe(false);
  });

  it('formats single process card when goal asks "which process is using the most cpu"', () => {
    const out = formatDataOutput({
      sortedBy: 'cpu',
      activeProcesses: [
        { pid: 52374, name: 'llama-server', cpuPercent: 196, ramPercent: 19.9 },
        { pid: 50208, name: 'Isolated Web Co', cpuPercent: 29.7, ramPercent: 4.3 }
      ]
    }, { goal: 'which process is using the most cpu' });

    expect(out).toContain('▶ Top Process (sorted by CPU):');
    expect(out).toContain('llama-server');
    expect(out).not.toContain('Isolated Web Co');
  });
});
