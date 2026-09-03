import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddedEngineManager } from './EmbeddedEngineManager';

describe('EmbeddedEngineManager (In-App Local AI Integration)', () => {
  let manager: EmbeddedEngineManager;

  beforeEach(() => {
    manager = new EmbeddedEngineManager();
  });

  it('provides the sweet-spot 3B recommended model configuration', () => {
    const model = EmbeddedEngineManager.RECOMMENDED_MODEL;
    expect(model.id).toContain('3b');
    expect(model.fileName).toBe('qwen2.5-coder-3b-instruct-q4_k_m.gguf');
    expect(model.sizeBytes).toBeGreaterThan(1000000000); // ~1.9 GB
    expect(model.metalAcceleration).toBe(true);
  });

  it('checks status and reports model and engine availability', async () => {
    const status = await manager.getStatus();
    expect(status.port).toBe(8847);
    expect(status.engineInstalled).toBe(true);
    expect(status.modelDownloaded).toBe(true);
  });

  it('manages engine lifecycle commands', async () => {
    const started = await manager.startEngine();
    expect(typeof started).toBe('boolean');

    const stopped = await manager.stopEngine();
    expect(typeof stopped).toBe('boolean');
  });
});
