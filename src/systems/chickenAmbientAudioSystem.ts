import type { AudioService } from '../runtime/services';
import type { AudioEffectKey } from '../assets/audio';
import type { ChickenBehaviorSystem, BehaviorState } from './chickenBehaviorSystem';
import type { ChickFollowerManager } from './chickFollowerSystem';
import type { ChickenActionSystem } from './chickenActionSystem';
import type { ChickenFlapAnimator } from './chickenFlapAnimator';
import type { SoundPlaybackHandle } from '../lib/audio/soundEffect';

const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

const CLUCK_STATES: BehaviorState[] = ['walk', 'idle'];
const AMBIENT_CLUCK_VARIANTS: AudioEffectKey[] = [
  'chickenCluckSoft',
  'ambientCluck01',
  'ambientCluck02',
  'ambientCluck03',
  'ambientCluck04',
];
const WING_SOUND_BLOCK_LIST = new Set(['disco-party']);

export type ChickenAmbientAudioSystem = {
  update: (deltaMS: number) => void;
  destroy: () => void;
};

export const createChickenAmbientAudioSystem = (options: {
  audioService: AudioService;
  behaviorSystem: ChickenBehaviorSystem;
  actionSystem: ChickenActionSystem;
  chickFollower: ChickFollowerManager;
  flapAnimator: ChickenFlapAnimator;
}): ChickenAmbientAudioSystem => {
  const { audioService, behaviorSystem, actionSystem, chickFollower, flapAnimator } = options;

  const scheduleCluck = () => randomRange(4500, 11000);
  const scheduleChick = () => randomRange(6000, 16000);

  let cluckTimer = scheduleCluck();
  let chickTimer = scheduleChick();
  let wingHandle: SoundPlaybackHandle | null = null;

  const stopWingSound = () => {
    wingHandle?.stop();
    wingHandle = null;
  };

  const maybePlayCluck = (deltaMS: number) => {
    const isActionActive = actionSystem.isActionActive();
    const currentState = behaviorSystem.getState();
    const shouldCluck = !isActionActive && CLUCK_STATES.includes(currentState);
    if (!shouldCluck) {
      cluckTimer = scheduleCluck();
      return;
    }
    cluckTimer -= deltaMS;
    if (cluckTimer > 0) {
      return;
    }
    const effect = AMBIENT_CLUCK_VARIANTS[Math.floor(Math.random() * AMBIENT_CLUCK_VARIANTS.length)];
    const baseVolume = effect === 'chickenCluckSoft' ? 0.6 : 0.64;
    audioService.playEffect(effect, {
      volume: baseVolume,
      playbackRate: randomRange(0.92, 1.08),
    });
    cluckTimer = scheduleCluck();
  };

  const maybePlayChick = (deltaMS: number) => {
    if (!chickFollower.hasChick()) {
      chickTimer = scheduleChick();
      return;
    }
    chickTimer -= deltaMS;
    if (chickTimer > 0) {
      return;
    }
    audioService.playEffect('chickPeep', {
      volume: randomRange(0.55, 0.75),
      playbackRate: randomRange(0.95, 1.05),
    });
    chickTimer = scheduleChick();
  };

  const updateWingSound = () => {
    const running = flapAnimator.isRunning();
    const currentActionId = actionSystem.getCurrentActionId();
    const allowWingSound = running && !WING_SOUND_BLOCK_LIST.has(currentActionId ?? '');
    if (allowWingSound) {
      if (!wingHandle) {
        wingHandle = audioService.playEffect('chickenWingFlap', {
          loop: true,
          volume: 0.25,
        });
      }
      return;
    }
    if (wingHandle) {
      stopWingSound();
    }
  };

  const update = (deltaMS: number) => {
    maybePlayCluck(deltaMS);
    maybePlayChick(deltaMS);
    updateWingSound();
  };

  const destroy = () => {
    stopWingSound();
  };

  return { update, destroy };
};
