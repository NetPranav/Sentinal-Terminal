import { describe, it, expect, beforeEach } from 'vitest';
import { EpisodicMemoryEngine } from './EpisodicMemoryEngine';

describe('EpisodicMemoryEngine — Continuous On-Device Learning & Retrieval', () => {
  let engine: EpisodicMemoryEngine;

  beforeEach(() => {
    engine = EpisodicMemoryEngine.getInstance();
    engine.clear();
  });

  it('should record episodic memories from demonstrations', () => {
    const memory = engine.recordMemory(
      'show me all connected wifi networks',
      'networksetup -listpreferredwirelessnetworks en0',
      { explanation: 'Lists preferred Wi-Fi networks on macOS' }
    );

    expect(memory).toBeDefined();
    expect(memory.id).toMatch(/^mem_/);
    expect(memory.goal).toBe('show me all connected wifi networks');
    expect(memory.command).toBe('networksetup -listpreferredwirelessnetworks en0');
    expect(engine.getAllMemories().length).toBe(1);
  });

  it('should retrieve semantically similar memories for related user queries', () => {
    engine.recordMemory(
      'find all frontend directories on my mac',
      `mdfind "kMDItemFSName == '*frontend*'c && kMDItemContentType == 'public.folder'"`,
      { explanation: 'Spotlight search for frontend folders' }
    );

    engine.recordMemory(
      'kill process running on port 3000',
      'lsof -ti:3000 | xargs kill -9',
      { explanation: 'Kill port 3000 listeners' }
    );

    // Query with different wording
    const matches = engine.retrieveSimilar('can you locate frontend folders in the system');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].goal).toBe('find all frontend directories on my mac');
    expect(matches[0].command).toContain('mdfind');
  });

  it('should format retrieved memories into few-shot system prompt examples', () => {
    const mem1 = engine.recordMemory(
      'list bluetooth devices',
      'system_profiler SPBluetoothDataType',
      { explanation: 'Inspect Bluetooth system profile' }
    );

    const formatted = engine.formatPromptFewShots([mem1]);
    expect(formatted).toContain('# User Demonstrated Workflows & Learned Patterns:');
    expect(formatted).toContain('User: "list bluetooth devices"');
    expect(formatted).toContain('system_profiler SPBluetoothDataType');
  });

  it('should update existing memory when identical goal is demonstrated again', () => {
    engine.recordMemory('check battery status', 'pmset -g batt');
    expect(engine.getAllMemories().length).toBe(1);

    engine.recordMemory('check battery status', 'pmset -g ps');
    expect(engine.getAllMemories().length).toBe(1);
    expect(engine.getAllMemories()[0].command).toBe('pmset -g ps');
  });
});
