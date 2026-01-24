import { afterEach, describe, expect, it, vi } from 'vitest';

type AudioListener = () => void;

class FakeAudio {
  src: string;
  preload = '';
  loop = false;
  muted = false;
  volume = 1;
  playbackRate = 1;
  currentTime = 0;
  paused = true;
  playCalls = 0;
  pauseCalls = 0;
  listeners = new Map<string, Set<AudioListener>>();

  constructor(src: string) {
    this.src = src;
  }

  addEventListener(type: string, listener: AudioListener) {
    const set = this.listeners.get(type) ?? new Set<AudioListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  play() {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }
}

describe('soundEffect', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('primes by creating an audio element and performing a play/pause cycle', async () => {
    vi.resetModules();

    const created: FakeAudio[] = [];
    const AudioCtor = function Audio(this: unknown, src: string) {
      const instance = new FakeAudio(src);
      created.push(instance);
      return instance;
    } as unknown as typeof Audio;

    vi.stubGlobal('window', {} as Window);
    vi.stubGlobal('Audio', AudioCtor);

    const { createSoundEffect } = await import('../../../src/lib/audio/soundEffect');

    const effect = createSoundEffect('/test.mp3', { baseVolume: 0.5, maxConcurrent: 1 });
    effect.prime();

    await Promise.resolve();

    expect(created).toHaveLength(1);
    expect(created[0]?.playCalls).toBe(1);
    expect(created[0]?.pauseCalls).toBe(1);
    expect(created[0]?.volume).toBeCloseTo(0.5, 5);
  });
});
