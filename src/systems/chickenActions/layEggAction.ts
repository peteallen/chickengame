import type { ChickenActionDefinition } from '../chickenActionSystem';
import { CHICKEN_IDLE_POSE } from '../../entities/chicken';
import { createEgg, type Egg, EGG_METRICS } from '../../entities/egg';
import type { BehaviorControlHandle } from './behaviorControl';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const randomRange = (min: number, max: number) => min + Math.random() * (max - min);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const SQUAT_IN_DURATION_MS = 1400;
const SHAKE_DURATION_MS = 1900;
const STAND_DURATION_MS = 900;
const STAND_START_MS = SQUAT_IN_DURATION_MS + SHAKE_DURATION_MS;
const STAND_END_MS = STAND_START_MS + STAND_DURATION_MS;
const WALK_LOCK_DURATION_MS = 5000;

const EGG_SPAWN_TIME_MS = SQUAT_IN_DURATION_MS + 900;
const EGG_SHAKE_START_MS = EGG_SPAWN_TIME_MS + 3200;
const EGG_SHAKE_DURATION_MS = 2400;
const EGG_CRACK_START_MS = EGG_SHAKE_START_MS + 1600;
const EGG_HATCH_MS = EGG_CRACK_START_MS + 1200;
const CHICK_REVEAL_MS = EGG_HATCH_MS + 500;
const EGG_REMOVE_MS = CHICK_REVEAL_MS;

const CHICK_FOLLOW_DURATION_MS = 60000;
const CHICK_FADE_DURATION_MS = 1200;
const ACTION_DURATION_MS = CHICK_REVEAL_MS + 2400;

export const createLayEggAction = (): ChickenActionDefinition => ({
  id: 'lay-egg',
  weight: 1.15,
  create: (context) => {
    const {
      chicken,
      behaviorSystem,
      environmentScene,
      theme,
      chickFollower,
      depthSystem,
      behaviorControls,
    } = context;

    const penLayer = environmentScene.penLayer;
    let controlReleased = false;
    let behaviorHandle: BehaviorControlHandle | null = null;
    let egg: Egg | null = null;
    let eggPosition: { x: number; y: number } | null = null;
    let eggGroundY: number | null = null;
    let eggShakePhase = 0;
    let eggRemoved = false;
    let eggSpawned = false;

    let hasSpawnedChick = false;
    let walkAwayStarted = false;
    let walkLockReleaseAt: number | null = null;

    const releaseControl = () => {
      if (controlReleased) {
        return;
      }
      controlReleased = true;
      behaviorHandle?.release();
      behaviorHandle = null;
      chicken.resetPose();
    };

    const cleanupEgg = () => {
      if (!egg) {
        return;
      }
      depthSystem.unregister(egg.view);
      egg.view.parent?.removeChild(egg.view);
      egg.destroy();
      egg = null;
      eggGroundY = null;
    };

    const startWalkAway = (elapsedMS: number) => {
      if (walkAwayStarted) {
        return;
      }
      walkAwayStarted = true;
      releaseControl();
      behaviorSystem.setStateLock('walk');
      behaviorSystem.setSpeedMultiplier(1.1);
      walkLockReleaseAt = elapsedMS + WALK_LOCK_DURATION_MS;
    };

    const spawnEgg = () => {
      if (egg || eggSpawned) {
        return;
      }
      const eggEntity = createEgg(theme.chicken);
      const scale = Math.abs(chicken.view.scale.y);
      eggEntity.view.scale.set(scale, scale);
      const facing = chicken.getFacing();
      const eggOffsetX = facing === 'left' ? -18 : 18;
      const eggOffsetY = chicken.metrics.feet.groundY + chicken.metrics.feet.toeLength * 0.1;
      const x = chicken.view.position.x + eggOffsetX;
      const y = chicken.view.position.y + eggOffsetY;
      eggEntity.view.position.set(x, y);
      penLayer.addChild(eggEntity.view);
      depthSystem.register({
        target: eggEntity.view,
        layer: 1,
        getDepth: () =>
          eggEntity.view.position.y +
          (EGG_METRICS.height / 2) * Math.abs(eggEntity.view.scale.y),
        bias: -0.3,
      });
      egg = eggEntity;
      eggPosition = { x, y };
      eggGroundY = y + (EGG_METRICS.height / 2) * scale;
      eggSpawned = true;
    };

    const updateChickenPose = (elapsedMS: number) => {
      if (controlReleased) {
        return;
      }
      if (elapsedMS < STAND_START_MS) {
        const squatProgress = clamp(elapsedMS / SQUAT_IN_DURATION_MS, 0, 1);
        const shakeProgress = clamp((elapsedMS - SQUAT_IN_DURATION_MS) / SHAKE_DURATION_MS, 0, 1);
        const squatEase = easeInOutCubic(squatProgress);
        const shakeStrength = Math.pow(clamp(shakeProgress, 0, 1), 1.4);
        const wobble = Math.sin((elapsedMS / 1000) * 6) * shakeStrength;
        const micro = Math.sin((elapsedMS / 1000) * 13) * shakeStrength * 0.3;

        chicken.setPose({
          bodyLift: (CHICKEN_IDLE_POSE.bodyLift ?? 0) + lerp(0, 34, squatEase),
          bodyLean: (CHICKEN_IDLE_POSE.bodyLean ?? 0) - 0.16 * squatEase + micro * 0.02,
          headPitch: (CHICKEN_IDLE_POSE.headPitch ?? 0) + 0.52 * squatEase,
          headBob: (CHICKEN_IDLE_POSE.headBob ?? 0) + lerp(0, 26, squatEase) + wobble * 1.5,
          headForward: lerp(0, 12, squatEase),
          beakOpen: 0.05 + shakeStrength * 0.08,
          wingPitch: -0.2 * squatEase + micro * 0.06,
          wingLift: -8 * squatEase + wobble * 2,
          tailLift: (CHICKEN_IDLE_POSE.tailLift ?? 0) - 0.2 * squatEase + wobble * 0.01,
          tailSplay: (CHICKEN_IDLE_POSE.tailSplay ?? 0.4) + 0.08 * squatEase,
          stride: 0,
          frontFootLift: -10 * squatEase,
          backFootLift: -6 * squatEase,
        });
        return;
      }

      if (elapsedMS < STAND_END_MS) {
        const standProgress = clamp((elapsedMS - STAND_START_MS) / STAND_DURATION_MS, 0, 1);
        const eased = easeOutBack(standProgress);
        const settle = 1 - easeInOutCubic(standProgress);
        chicken.setPose({
          bodyLift: lerp((CHICKEN_IDLE_POSE.bodyLift ?? 0) + 34, CHICKEN_IDLE_POSE.bodyLift ?? 0, eased),
          bodyLean: lerp((CHICKEN_IDLE_POSE.bodyLean ?? 0) - 0.16, CHICKEN_IDLE_POSE.bodyLean ?? 0, eased),
          headPitch: lerp((CHICKEN_IDLE_POSE.headPitch ?? 0) + 0.52, CHICKEN_IDLE_POSE.headPitch ?? 0, eased),
          headBob: lerp((CHICKEN_IDLE_POSE.headBob ?? 0) + 24, CHICKEN_IDLE_POSE.headBob ?? 0, eased),
          headForward: lerp(12, 0, eased),
          beakOpen: 0.04 + settle * 0.08,
          wingPitch: lerp(-0.2, 0, eased),
          wingLift: lerp(-6, 0, eased),
          tailLift: lerp((CHICKEN_IDLE_POSE.tailLift ?? 0) - 0.18, CHICKEN_IDLE_POSE.tailLift ?? 0, eased),
          tailSplay: lerp((CHICKEN_IDLE_POSE.tailSplay ?? 0.4) + 0.08, CHICKEN_IDLE_POSE.tailSplay ?? 0.4, eased),
          stride: lerp(0, chicken.getFacing() === 'right' ? 0.3 : -0.3, eased),
          frontFootLift: -6 * settle,
          backFootLift: -4 * settle,
        });
        return;
      }
      startWalkAway(elapsedMS);
    };

    const updateEgg = (deltaMS: number, elapsedMS: number) => {
      if (!egg) {
        return;
      }
      if (elapsedMS >= EGG_SHAKE_START_MS && elapsedMS <= EGG_SHAKE_START_MS + EGG_SHAKE_DURATION_MS) {
        eggShakePhase += deltaMS * 0.02;
        const shakeProgress = clamp((elapsedMS - EGG_SHAKE_START_MS) / EGG_SHAKE_DURATION_MS, 0, 1);
        egg.setShake(eggShakePhase, Math.pow(shakeProgress, 1.2));
      } else {
        egg.setShake(0, 0);
      }

      if (elapsedMS >= EGG_CRACK_START_MS && elapsedMS <= EGG_HATCH_MS) {
        const crackProgress = clamp((elapsedMS - EGG_CRACK_START_MS) / (EGG_HATCH_MS - EGG_CRACK_START_MS), 0, 1);
        egg.setCrackAmount(crackProgress);
      }

      if (elapsedMS >= EGG_HATCH_MS && elapsedMS <= CHICK_REVEAL_MS) {
        const hatchProgress = clamp((elapsedMS - EGG_HATCH_MS) / (CHICK_REVEAL_MS - EGG_HATCH_MS), 0, 1);
        egg.setHatchProgress(hatchProgress);
      }

      if (elapsedMS >= EGG_REMOVE_MS && !eggRemoved) {
        eggRemoved = true;
        cleanupEgg();
      }
    };

    return {
      durationMS: ACTION_DURATION_MS,
      onEnter: () => {
        controlReleased = false;
        behaviorHandle = behaviorControls.takeover({
          animatorAuthority: 'external',
          stateLock: 'idle',
          speedMultiplier: 0,
        });
        chicken.resetPose();
      },
      onUpdate: (deltaMS, elapsedMS) => {
        if (elapsedMS >= EGG_SPAWN_TIME_MS && !egg) {
          spawnEgg();
        }
        updateChickenPose(elapsedMS);
        updateEgg(deltaMS, elapsedMS);
        if (!hasSpawnedChick && elapsedMS >= CHICK_REVEAL_MS && eggPosition) {
          const chickScale = Math.max(0.35, Math.abs(chicken.view.scale.y) * 0.55);
          const footY = eggGroundY ?? eggPosition.y;
          chickFollower.spawn({
            target: chicken,
            position: { x: eggPosition.x, footY },
            baseScale: chickScale,
            facing: chicken.getFacing(),
            followDurationMS: CHICK_FOLLOW_DURATION_MS,
            fadeDurationMS: CHICK_FADE_DURATION_MS,
          });
          hasSpawnedChick = true;
        }
        if (walkAwayStarted && walkLockReleaseAt && elapsedMS >= walkLockReleaseAt) {
          walkLockReleaseAt = null;
          behaviorSystem.setStateLock(null);
          behaviorSystem.setSpeedMultiplier(1);
        }
      },
      onExit: () => {
        releaseControl();
        cleanupEgg();
      },
    };
  },
});
