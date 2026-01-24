import { afterEach, describe, expect, it, vi } from 'vitest';

type Listener = () => void;

describe('audioService', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('unlocks effects on first user gesture', async () => {
    vi.resetModules();

    const listeners = new Map<string, Set<Listener>>();
    const windowStub = {
      addEventListener: (type: string, listener: Listener) => {
        const set = listeners.get(type) ?? new Set<Listener>();
        set.add(listener);
        listeners.set(type, set);
      },
      removeEventListener: (type: string, listener: Listener) => {
        listeners.get(type)?.delete(listener);
      },
    } as unknown as Window;

    vi.stubGlobal('window', windowStub);

    const primes: Array<ReturnType<typeof vi.fn>> = [];

    vi.doMock('../../../src/assets/audio', () => ({
      audioManifest: {
        pottyFart: '/potty_fart.mp3',
        pottyPlop: '/potty_plop.mp3',
      },
    }));

    vi.doMock('../../../src/lib/audio/soundEffect', () => ({
      createSoundEffect: vi.fn(() => {
        const prime = vi.fn();
        primes.push(prime);
        return {
          play: vi.fn(() => null),
          prime,
          stopAll: vi.fn(),
          destroy: vi.fn(),
        };
      }),
    }));

    const { createAudioService } = await import('../../../src/runtime/services/audioService');

    const service = createAudioService();

    expect(listeners.get('pointerdown')?.size).toBe(1);
    expect(listeners.get('touchstart')?.size).toBe(1);
    expect(listeners.get('keydown')?.size).toBe(1);

    const pointerHandler = listeners.get('pointerdown')?.values().next().value;
    pointerHandler?.();

    expect(primes).toHaveLength(2);
    const called = primes.filter((prime) => prime.mock.calls.length > 0);
    expect(called).toHaveLength(1);
    expect(called[0]).toHaveBeenCalledTimes(1);

    expect(listeners.get('pointerdown')?.size).toBe(0);
    expect(listeners.get('touchstart')?.size).toBe(0);
    expect(listeners.get('keydown')?.size).toBe(0);

    service.destroy();
  });
});
