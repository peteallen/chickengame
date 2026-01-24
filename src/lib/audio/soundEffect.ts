const hasAudioSupport = typeof window !== 'undefined' && typeof Audio !== 'undefined';

const clampVolume = (value: number) => Math.max(0, Math.min(1, value));

export type SoundEffectPlayOptions = {
  volume?: number;
  loop?: boolean;
  playbackRate?: number;
  startTime?: number;
};

export type SoundPlaybackHandle = {
  stop: () => void;
  setVolume: (value: number) => void;
  isPlaying: () => boolean;
};

export type SoundEffect = {
  play: (options?: SoundEffectPlayOptions) => SoundPlaybackHandle | null;
  prime: () => void;
  stopAll: () => void;
  destroy: () => void;
};

export type CreateSoundEffectOptions = {
  baseVolume?: number;
  loop?: boolean;
  maxConcurrent?: number;
};

const noopSoundEffect: SoundEffect = {
  play: () => null,
  prime: () => {},
  stopAll: () => {},
  destroy: () => {},
};

export const createSoundEffect = (
  source: string,
  options: CreateSoundEffectOptions = {},
): SoundEffect => {
  if (!hasAudioSupport || !source) {
    return noopSoundEffect;
  }

  const pool: HTMLAudioElement[] = [];
  const maxConcurrent = Math.max(1, Math.floor(options.maxConcurrent ?? 3));
  const defaultVolume = clampVolume(options.baseVolume ?? 1);

  const createElement = () => {
    const audio = new Audio(source);
    audio.preload = 'auto';
    audio.loop = Boolean(options.loop);
    audio.volume = defaultVolume;
    audio.playbackRate = 1;
    audio.addEventListener('ended', () => {
      if (!audio.loop) {
        audio.currentTime = 0;
      }
    });
    pool.push(audio);
    return audio;
  };

  const acquireElement = () => {
    for (const audio of pool) {
      if (audio.paused) {
        return audio;
      }
    }
    if (pool.length < maxConcurrent) {
      return createElement();
    }
    return pool[0];
  };

  const play: SoundEffect['play'] = (playOptions) => {
    const audio = acquireElement();
    if (!audio) {
      return null;
    }
    audio.loop = playOptions?.loop ?? options.loop ?? false;
    audio.volume = clampVolume(playOptions?.volume ?? defaultVolume);
    audio.playbackRate = playOptions?.playbackRate ?? 1;
    if (typeof playOptions?.startTime === 'number' && Number.isFinite(playOptions.startTime)) {
      try {
        audio.currentTime = playOptions.startTime;
      } catch {
        // Some browsers throw if metadata is not ready; ignore so playback can proceed once ready.
      }
    } else if (!audio.loop) {
      audio.currentTime = 0;
    }

    const playbackPromise = audio.play();
    if (playbackPromise && typeof playbackPromise.catch === 'function') {
      playbackPromise.catch(() => {});
    }

    return {
      stop: () => {
        audio.pause();
        if (!audio.loop) {
          audio.currentTime = 0;
        }
      },
      setVolume: (value: number) => {
        audio.volume = clampVolume(value);
      },
      isPlaying: () => !audio.paused,
    } satisfies SoundPlaybackHandle;
  };

  const prime: SoundEffect['prime'] = () => {
    const audio =
      pool.find((entry) => entry.paused) ??
      (pool.length < maxConcurrent ? createElement() : null);
    if (!audio) {
      return;
    }

    const previous = {
      muted: audio.muted,
      volume: audio.volume,
      loop: audio.loop,
      playbackRate: audio.playbackRate,
    };

    audio.muted = previous.muted;
    audio.loop = false;
    audio.playbackRate = 1;
    audio.volume = 0;

    try {
      audio.currentTime = 0;
    } catch {
      // Ignore metadata readiness issues.
    }

    const finish = () => {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore metadata readiness issues.
      }
      audio.muted = previous.muted;
      audio.volume = previous.volume;
      audio.loop = previous.loop;
      audio.playbackRate = previous.playbackRate;
    };

    const playbackPromise = audio.play();
    if (playbackPromise && typeof playbackPromise.then === 'function') {
      void playbackPromise.then(finish).catch(finish);
      return;
    }
    finish();
  };

  const stopAll = () => {
    pool.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  };

  const destroy = () => {
    stopAll();
    pool.forEach((audio) => {
      audio.src = '';
    });
    pool.length = 0;
  };

  return { play, prime, stopAll, destroy } satisfies SoundEffect;
};
