import { createEdmLoop, type EdmLoop } from '../../lib/audio/edmLoop';
import { audioManifest, type AudioEffectKey } from '../../assets/audio';
import {
  createSoundEffect,
  type CreateSoundEffectOptions,
  type SoundEffect,
  type SoundEffectPlayOptions,
  type SoundPlaybackHandle,
} from '../../lib/audio/soundEffect';

export type AudioLoopKey = 'edm';

export type AudioService = {
  playLoop: (key: AudioLoopKey) => Promise<void>;
  stopLoop: (key: AudioLoopKey) => void;
  getLoop: (key: AudioLoopKey) => EdmLoop | undefined;
  playEffect: (key: AudioEffectKey, options?: SoundEffectPlayOptions) => SoundPlaybackHandle | null;
  stopEffect: (key: AudioEffectKey) => void;
  stopAllEffects: () => void;
  stopAll: () => void;
  destroy: () => void;
};

const effectConfigs: Record<AudioEffectKey, CreateSoundEffectOptions> = {
  balloonInflation: { loop: true, maxConcurrent: 1, baseVolume: 0.68 },
  discoCrowdApplause: { maxConcurrent: 1, baseVolume: 0.8 },
  fireworksShow: { maxConcurrent: 1, baseVolume: 0.75 },
  henLaysChatter: { maxConcurrent: 2, baseVolume: 0.72 },
  jetpackAirLeakLoop: { loop: true, maxConcurrent: 1, baseVolume: 0.6 },
  chickenCluckSoft: { loop: false, maxConcurrent: 1, baseVolume: 0.55 },
  ambientCluck01: { maxConcurrent: 1, baseVolume: 0.58 },
  ambientCluck02: { maxConcurrent: 1, baseVolume: 0.58 },
  ambientCluck03: { maxConcurrent: 1, baseVolume: 0.58 },
  ambientCluck04: { maxConcurrent: 1, baseVolume: 0.58 },
  chickenCackle: { maxConcurrent: 1, baseVolume: 0.88 },
  chickenWingFlap: { loop: true, maxConcurrent: 1, baseVolume: 0.35 },
  chickPeep: { maxConcurrent: 3, baseVolume: 0.6 },
  bubbleBurst: { maxConcurrent: 1, baseVolume: 0.88 },
  eggShellPop: { maxConcurrent: 1, baseVolume: 0.8 },
};

export const createAudioService = (): AudioService => {
  const loops = new Map<AudioLoopKey, EdmLoop>([['edm', createEdmLoop()]]);
  const effects = new Map<AudioEffectKey, SoundEffect>(
    (Object.keys(audioManifest) as AudioEffectKey[]).map((key) => [
      key,
      createSoundEffect(audioManifest[key], effectConfigs[key]),
    ]),
  );

  const getLoop = (key: AudioLoopKey) => loops.get(key);

  const playLoop = async (key: AudioLoopKey) => {
    const loop = loops.get(key);
    if (!loop) {
      return;
    }
    await loop.start();
  };

  const stopLoop = (key: AudioLoopKey) => {
    loops.get(key)?.stop();
  };

  const playEffect: AudioService['playEffect'] = (key, options) => {
    const effect = effects.get(key);
    return effect?.play(options) ?? null;
  };

  const stopEffect = (key: AudioEffectKey) => {
    effects.get(key)?.stopAll();
  };

  const stopAllEffects = () => {
    effects.forEach((effect) => effect.stopAll());
  };

  const stopAll = () => {
    loops.forEach((loop) => loop.stop());
    stopAllEffects();
  };

  const destroy = () => {
    stopAll();
    loops.clear();
    effects.forEach((effect) => effect.destroy());
    effects.clear();
  };

  return {
    playLoop,
    stopLoop,
    getLoop,
    playEffect,
    stopEffect,
    stopAllEffects,
    stopAll,
    destroy,
  };
};
