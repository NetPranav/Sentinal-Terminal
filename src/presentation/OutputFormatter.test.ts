import { describe, it, expect } from 'vitest';
import { formatAgentEvent, formatMarkdownTerminal } from './OutputFormatter';

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
});
