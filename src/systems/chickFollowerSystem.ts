import type { Chicken } from '../entities/chicken';
import { createChick, type Chick } from '../entities/chick';
import type { Theme } from '../config/theme';
import type { EnvironmentScene } from '../scenes/environmentScene';
import type { PenConstraintSystem } from './penConstraintSystem';
import type { RenderDepthSystem } from './renderDepthSystem';
import type { AudioService } from '../runtime/services';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

type SpawnOptions = {
  target: Chicken;
  position: { x: number; footY: number };
  baseScale: number;
  facing: 'left' | 'right';
  followDurationMS: number;
  fadeDurationMS: number;
};

type ActiveChick = {
  chick: Chick;
  target: Chicken;
  offset: { x: number; y: number };
  stridePhase: number;
  retargetTimer: number;
  retargetInterval: number;
  speed: number;
  lifeMS: number;
  followDuration: number;
  fadeDuration: number;
  jump?: {
    elapsed: number;
    duration: number;
  };
};

export type ChickFollowerManager = {
  spawn: (options: SpawnOptions) => void;
  clear: () => void;
  update: (deltaMS: number) => void;
  hasChick: () => boolean;
  setFollowingEnabled: (enabled: boolean) => void;
  destroy: () => void;
};

const computeFollowOffset = (target: Chicken) => {
  const facing = target.getFacing();
  const radius = randomRange(30, 85);
  const baseAngle = facing === 'left' ? Math.PI : 0;
  const angle = baseAngle + randomRange(-Math.PI / 5, Math.PI / 5);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.45,
  };
};

export const createChickFollowerManager = (options: {
  environmentScene: EnvironmentScene;
  penConstraints: PenConstraintSystem;
  theme: Theme;
  depthSystem: RenderDepthSystem;
  audioService: AudioService;
}): ChickFollowerManager => {
  const { environmentScene, penConstraints, theme, depthSystem, audioService } = options;
  const penLayer = environmentScene.penLayer;
  const fadeInDurationMS = 800;
  let active: ActiveChick | null = null;
  let followEnabled = true;

  const clear = () => {
    if (!active) {
      return;
    }
    penConstraints.unregister(active.chick.view);
    depthSystem.unregister(active.chick.view);
    active.chick.view.parent?.removeChild(active.chick.view);
    active.chick.destroy();
    active = null;
  };

  const triggerJump = () => {
    if (!active || active.jump) return;
    
    active.jump = {
      elapsed: 0,
      duration: 800,
    };
    void audioService.playEffect('chickPeep', { volume: 0.8, pitch: randomRange(0.9, 1.1) });
  };

  const spawn = ({ target, position, baseScale, facing, followDurationMS, fadeDurationMS }: SpawnOptions) => {
    clear();
    const chick = createChick(theme.chick);
    chick.setScale(baseScale);
    chick.setFacing(facing);
    const viewY = position.footY - chick.metrics.feet.groundY * baseScale;
    chick.view.position.set(position.x, viewY);
    chick.view.alpha = 0;
    
    // Interaction for jump
    chick.view.cursor = 'pointer';
    chick.view.on('pointerdown', triggerJump);

    penLayer.addChild(chick.view);
    penConstraints.register({ target: chick.view, mode: 'pen', behavior: 'clamp' });
    depthSystem.register({
      target: chick.view,
      layer: 1,
      getDepth: () =>
        chick.view.position.y +
        chick.metrics.feet.groundY * Math.abs(chick.view.scale.y),
      bias: -0.1,
    });

    active = {
      chick,
      target,
      offset: computeFollowOffset(target),
      stridePhase: Math.random() * Math.PI * 2,
      retargetTimer: 0,
      retargetInterval: randomRange(900, 2400),
      speed: randomRange(70, 110),
      lifeMS: 0,
      followDuration: Math.max(followDurationMS, 0),
      fadeDuration: Math.max(200, fadeDurationMS),
    };

    if (!followEnabled) {
      chick.resetPose();
    }
  };

  const update = (deltaMS: number) => {
    if (!active) {
      return;
    }
    const { chick, target } = active;
    active.lifeMS += deltaMS;

    if (active.jump) {
      active.jump.elapsed += deltaMS;
      const progress = active.jump.elapsed / active.jump.duration;
      
      if (progress >= 1) {
        active.jump = undefined;
        // Resume normal pose
        chick.resetPose();
      } else {
        // Jump physics/animation
        const jumpHeight = Math.sin(progress * Math.PI) * 60;
        const spin = progress * Math.PI * 4; // 2 spins
        
        chick.setPose({
          bodyLift: jumpHeight,
          wingLift: 12 + Math.sin(progress * 30) * 8,
          bodyLean: spin,
          headTilt: spin * 0.5,
          beakOpen: 0.5,
          frontFootLift: 10,
          backFootLift: 10,
        });
      }
    } else if (followEnabled) {
      // Retarget spacing occasionally for more organic wandering
      active.retargetTimer += deltaMS;
      if (active.retargetTimer >= active.retargetInterval) {
        active.offset = computeFollowOffset(target);
        active.retargetTimer = 0;
        active.retargetInterval = randomRange(900, 2400);
      }

      const targetPosition = target.view.position;
      const desired = {
        x: targetPosition.x + active.offset.x,
        y: targetPosition.y + active.offset.y,
      };

      const current = chick.view.position;
      const dx = desired.x - current.x;
      const dy = desired.y - current.y;
      const distance = Math.hypot(dx, dy);
      const step = (active.speed * deltaMS) / 1000;
      const ratio = distance === 0 ? 0 : Math.min(1, step / distance);
      chick.view.position.set(current.x + dx * ratio, current.y + dy * ratio);

      active.stridePhase += (deltaMS / 1000) * (active.speed / 36 + 0.6);
      const strideWave = Math.sin(active.stridePhase);
      const hopWave = Math.max(0, Math.sin(active.stridePhase * 2));
      chick.setFacing(dx >= 0 ? 'right' : 'left');
      chick.setPose({
        stride: strideWave * 0.8,
        hop: hopWave * 6,
        wingLift: Math.sin(active.stridePhase * 2.1) * 0.35,
        wingSpread: Math.sin(active.stridePhase * 0.9) * 0.4,
        headTilt: Math.sin(active.stridePhase * 0.5) * 0.25,
        headForward: Math.sin(active.stridePhase * 0.8) * 4,
        beakOpen: 0.06 + Math.max(0, strideWave) * 0.08,
        tailLift: Math.sin(active.stridePhase * 1.4) * 0.1,
      });
    }

    const fadeIn = clamp(active.lifeMS / fadeInDurationMS, 0, 1);
    let alpha = fadeIn;
    if (active.lifeMS > active.followDuration) {
      const fadeOutProgress = clamp((active.lifeMS - active.followDuration) / active.fadeDuration, 0, 1);
      alpha = Math.max(0, 1 - fadeOutProgress);
      if (fadeOutProgress >= 1) {
        clear();
        return;
      }
    }
    chick.view.alpha = alpha;
  };

  const setFollowingEnabled = (enabled: boolean) => {
    followEnabled = enabled;
    if (!followEnabled && active) {
      active.chick.resetPose();
    }
  };

  return {
    spawn,
    clear,
    update,
    hasChick: () => Boolean(active),
    setFollowingEnabled,
    destroy: () => {
      clear();
    },
  } as const;
};
