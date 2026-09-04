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

  it('supports attaching LoRA adapters and tracking activeLora status', async () => {
    const loraPath = '/Users/test/.sentinel/models/sentinel_mlx_lora.gguf';
    const started = await manager.startEngine(undefined, loraPath);
    expect(started).toBe(true);
    expect(manager.getActiveLora()).toBe(loraPath);

    const status = await manager.getStatus();
    expect(status.activeLora).toBe(loraPath);

    const stopped = await manager.stopEngine();
    expect(stopped).toBe(true);
    expect(manager.getActiveLora()).toBeUndefined();
  });

  it('hot-reloads a new LoRA adapter into the running engine', async () => {
    const initialLora = '/Users/test/.sentinel/models/v1_adapter.gguf';
    await manager.startEngine(undefined, initialLora);
    expect(manager.getActiveLora()).toBe(initialLora);

    const newLora = '/Users/test/.sentinel/models/sentinel_mlx_lora.gguf';
    const reloaded = await manager.hotReloadLora(newLora);
    expect(reloaded).toBe(true);
    expect(manager.getActiveLora()).toBe(newLora);

    const status = await manager.getStatus();
    expect(status.activeLora).toBe(newLora);
  });
});
