import type { ChickenActionDefinition } from '../chickenActionSystem';
import { CHICKEN_IDLE_POSE } from '../../entities/chicken';
import { createBalloonBundle, type BalloonBundle } from '../../entities/balloonBundle';

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;

const GRAB_DURATION_MS = 900;
const ASCEND_DURATION_MS = 1400;
const SUSPEND_DURATION_MS = 800;
const FALL_DURATION_MS = 1200;
const BALLOON_EXIT_DURATION_MS = 3200;

const ASCEND_END_MS = GRAB_DURATION_MS + ASCEND_DURATION_MS;
const SUSPEND_END_MS = ASCEND_END_MS + SUSPEND_DURATION_MS;
const FALL_END_MS = SUSPEND_END_MS + FALL_DURATION_MS;
const ACTION_DURATION_MS = FALL_END_MS + BALLOON_EXIT_DURATION_MS;
const BALLOON_RELEASE_TRIGGER_MS = ASCEND_END_MS + SUSPEND_DURATION_MS * 0.7;

const MAX_SWAY_DEG = 0.22;

export const createBalloonLiftAction = (): ChickenActionDefinition => ({
  id: 'balloon-lift',
  weight: 0.9,
  create: (context) => {
    const { chicken, behaviorSystem, environmentScene, depthSystem, theme, flapAnimator } = context;
    const penLayer = environmentScene.penLayer;

    const gripLocal = {
      x: chicken.metrics.body.offset.x + chicken.metrics.body.width * 0.35,
      y: chicken.metrics.body.offset.y - chicken.metrics.body.height * 0.35,
    };

    const maxLift = Math.max(140, Math.abs(chicken.view.scale.y) * 320);
    const basePosition = {
      x: chicken.view.position.x,
      y: chicken.view.position.y,
    };

    let bundle: BalloonBundle | null = null;
    let isReleased = false;
    let releaseStartMS: number | null = null;
    let balloonsExited = false;
    let isFalling = false;
    let releaseAnchor: { x: number; y: number } | null = null;
    let releaseVelocity = { x: 0, y: 0 };

    const spawnBundle = () => {
      if (bundle) {
        return;
      }
      bundle = createBalloonBundle({ theme });
      bundle.view.zIndex = chicken.view.zIndex + 1;
      penLayer.addChild(bundle.view);
      const target = bundle.view;
      depthSystem.register({
        target,
        layer: 1,
        getDepth: () => target.position.y,
        bias: 0.6,
      });
      updateBundleAttachment();
    };

    const removeBundle = () => {
      if (!bundle) {
        return;
      }
      depthSystem.unregister(bundle.view);
      bundle.view.parent?.removeChild(bundle.view);
      bundle.destroy();
      bundle = null;
    };

    const getGripWorldPosition = () => {
      const scaleX = chicken.view.scale.x;
      const scaleY = chicken.view.scale.y;
      return {
        x: chicken.view.position.x + gripLocal.x * scaleX,
        y: chicken.view.position.y + gripLocal.y * scaleY,
      };
    };

    const updateBundleAttachment = () => {
      if (!bundle || isReleased) {
        return;
      }
      const grip = getGripWorldPosition();
      bundle.view.position.set(grip.x, grip.y);
    };

    const applyChickenLift = (height: number, options?: { skipPose?: boolean }) => {
      const clamped = clamp(height / maxLift, 0, 1);
      chicken.view.position.y = basePosition.y - height;
      if (options?.skipPose) {
        return;
      }
      const grabPhase = clamp(height <= 0 ? 0 : (height / maxLift) * 1.1, 0, 1);
      const lean = -0.04 - MAX_SWAY_DEG * (1 - grabPhase) + clamped * 0.18;
      const wingLift = -6 - 22 * (1 - grabPhase) + clamped * 48;
      const headPitch = CHICKEN_IDLE_POSE.headPitch + 0.4 * clamped - 0.25 * (1 - grabPhase);
      const headBob = CHICKEN_IDLE_POSE.headBob - 20 * (1 - grabPhase) + clamped * 18;
      const pose = {
        bodyLean: lean,
        bodyLift: CHICKEN_IDLE_POSE.bodyLift - 12 * (1 - grabPhase) + clamped * 22,
        headPitch,
        headBob,
        headForward: CHICKEN_IDLE_POSE.headForward + 6 * clamped,
        beakOpen: CHICKEN_IDLE_POSE.beakOpen + 0.04 + clamped * 0.1,
        wingPitch: CHICKEN_IDLE_POSE.wingPitch - 0.25 - 0.65 * (1 - grabPhase) + clamped * 0.4,
        wingLift,
        tailLift: CHICKEN_IDLE_POSE.tailLift - 0.12 + clamped * 0.18,
        tailSplay: CHICKEN_IDLE_POSE.tailSplay + clamped * 0.25,
        stride: 0,
        frontFootLift: -10 * (1 - grabPhase) - clamped * 10,
        backFootLift: -6 * (1 - grabPhase) - clamped * 6,
      };
      chicken.setPose(pose);
    };

    const startRelease = (elapsedMS: number) => {
      if (!bundle || isReleased) {
        return;
      }
      isReleased = true;
      releaseStartMS = elapsedMS;
      releaseAnchor = { x: bundle.view.position.x, y: bundle.view.position.y };
      releaseVelocity = {
        x: (Math.random() - 0.5) * 0.08,
        y: -0.16 - Math.random() * 0.08,
      };
    };

    const updateRelease = (deltaMS: number, progress: number) => {
      if (!bundle || !releaseAnchor) {
        return;
      }
      releaseAnchor.x += releaseVelocity.x * deltaMS;
      releaseAnchor.y += releaseVelocity.y * deltaMS * (1 + progress * 0.6);
      releaseVelocity.x *= 0.999;
      releaseVelocity.y *= 1.002;
      bundle.view.position.set(releaseAnchor.x, releaseAnchor.y);
      if (!balloonsExited && releaseAnchor.y < -220) {
        balloonsExited = true;
        removeBundle();
      }
    };

    const updateBalloonDynamics = (
      elapsedMS: number,
      liftHeight: number,
      releaseProgress: number,
      deltaMS: number,
    ) => {
      if (!bundle) {
        return;
      }
      const normalizedLift = clamp(liftHeight / maxLift, 0, 1);
      const sway = Math.sin(elapsedMS * 0.004) * (6 + normalizedLift * 6);
      const bob = Math.sin(elapsedMS * 0.0023 + Math.PI / 3) * (10 + normalizedLift * 8);
      const offsetY = -bob * 0.4 - normalizedLift * 18 - releaseProgress * 20;
      bundle.setLiftOffset({ x: sway, y: offsetY });
      const grabTensionTarget = clamp((elapsedMS - GRAB_DURATION_MS * 0.2) / (GRAB_DURATION_MS + ASCEND_DURATION_MS * 0.5), 0, 1);
      bundle.setGrabProgress(isReleased ? 1 : grabTensionTarget);
      bundle.setReleaseProgress(releaseProgress);
      bundle.update(deltaMS);
    };

    return {
      durationMS: ACTION_DURATION_MS,
      onEnter: () => {
        behaviorSystem.setAnimatorAuthority('external');
        behaviorSystem.setStateLock('idle');
        behaviorSystem.setSpeedMultiplier(0);
        chicken.resetPose();
        flapAnimator.stop();
        spawnBundle();
        updateBundleAttachment();
      },
      onUpdate: (deltaMS, elapsedMS) => {
        const liftHeight = (() => {
          if (elapsedMS <= GRAB_DURATION_MS) {
            const prep = easeOutCubic(elapsedMS / GRAB_DURATION_MS);
            return prep * 6;
          }
          if (elapsedMS <= ASCEND_END_MS) {
            const t = (elapsedMS - GRAB_DURATION_MS) / ASCEND_DURATION_MS;
            return easeOutCubic(t) * maxLift;
          }
          if (elapsedMS <= SUSPEND_END_MS) {
            return maxLift;
          }
          if (elapsedMS <= FALL_END_MS) {
            const t = (elapsedMS - SUSPEND_END_MS) / FALL_DURATION_MS;
            return (1 - easeInOutSine(t)) * maxLift;
          }
          return 0;
        })();

        const fallingPhase = elapsedMS >= SUSPEND_END_MS;
        applyChickenLift(liftHeight, { skipPose: fallingPhase });
        if (!isReleased) {
          updateBundleAttachment();
        }

        if (!isReleased && elapsedMS >= BALLOON_RELEASE_TRIGGER_MS) {
          startRelease(elapsedMS);
        }

        if (!isFalling && fallingPhase) {
          isFalling = true;
          flapAnimator.start();
        }
        if (isFalling && elapsedMS >= FALL_END_MS && flapAnimator.isRunning()) {
          flapAnimator.stop();
          chicken.resetPose();
        }

        let releaseProgress = 0;
        if (isReleased && releaseStartMS !== null) {
          releaseProgress = clamp((elapsedMS - releaseStartMS) / BALLOON_EXIT_DURATION_MS, 0, 1);
          updateRelease(deltaMS, releaseProgress);
        }

        updateBalloonDynamics(elapsedMS, liftHeight, releaseProgress, deltaMS);
      },
      onExit: () => {
        behaviorSystem.setAnimatorAuthority('system');
        behaviorSystem.setStateLock(null);
        behaviorSystem.setSpeedMultiplier(1);
        if (flapAnimator.isRunning()) {
          flapAnimator.stop();
        }
        chicken.view.position.set(basePosition.x, basePosition.y);
        chicken.resetPose();
        removeBundle();
      },
    };
  },
});
