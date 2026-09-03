import { describe, it, expect, beforeEach } from 'vitest';
import { DemonstrationLearningEngine } from './DemonstrationLearningEngine';

describe('DemonstrationLearningEngine — Experiential Learning & Pattern Generalization', () => {
  let engine: DemonstrationLearningEngine;

  beforeEach(() => {
    engine = new DemonstrationLearningEngine();
    engine.clear();
  });

  it('autonomously learns a pattern when user demonstrates the manual solution after a failed goal', () => {
    const pattern = engine.learnFromDemonstration(
      'convert lecture.mp4 to webm',
      'ffmpeg -i lecture.mp4 -c:v libvpx-vp9 lecture.webm'
    );

    expect(pattern).not.toBeNull();
    expect(pattern?.originalGoal).toBe('convert lecture.mp4 to webm');
    expect(pattern?.commandTemplate).toContain('{1}');
    expect(pattern?.commandTemplate).toContain('{name_1}.webm');
  });

  it('recalls a learned pattern and interpolates new variable arguments', () => {
    // 1. Learn from demonstration
    engine.learnFromDemonstration(
      'convert lecture.mp4 to webm',
      'ffmpeg -i lecture.mp4 -c:v libvpx-vp9 lecture.webm'
    );

    // 2. Next time user asks for a completely different file
    const match = engine.matchGoal('convert holiday_recording.mp4 to webm');
    expect(match.matched).toBe(true);
    expect(match.interpolatedCommand).toBe('ffmpeg -i holiday_recording.mp4 -c:v libvpx-vp9 holiday_recording.webm');
    expect(match.explanation).toContain('ffmpeg -i holiday_recording.mp4');
  });

  it('handles conversational variations when recalling learned patterns (e.g. "please convert")', () => {
    engine.learnFromDemonstration(
      'convert lecture.mp4 to webm',
      'ffmpeg -i lecture.mp4 -c:v libvpx-vp9 lecture.webm'
    );

    const match = engine.matchGoal('please convert drone_flight.mp4 to webm format');
    expect(match.matched).toBe(true);
    expect(match.interpolatedCommand).toBe('ffmpeg -i drone_flight.mp4 -c:v libvpx-vp9 drone_flight.webm');
  });

  it('supports explicit teaching of workflow mappings', () => {
    engine.learnExplicit(
      'sync drone logs',
      'rsync -avz pi@192.168.1.50:/var/log/drone/ ./logs/',
      'Syncs remote drone telemetry and flight logs locally'
    );

    const match = engine.matchGoal('sync drone logs');
    expect(match.matched).toBe(true);
    expect(match.interpolatedCommand).toBe('rsync -avz pi@192.168.1.50:/var/log/drone/ ./logs/');
    expect(match.pattern?.explanation).toBe('Syncs remote drone telemetry and flight logs locally');
  });

  it('allows forgetting a learned pattern', () => {
    const pattern = engine.learnExplicit('test command', 'echo hello');
    expect(engine.getAllPatterns().length).toBe(1);

    const forgot = engine.forgetPattern(pattern.id);
    expect(forgot).toBe(true);
    expect(engine.getAllPatterns().length).toBe(0);
    expect(engine.matchGoal('test command').matched).toBe(false);
  });
});
