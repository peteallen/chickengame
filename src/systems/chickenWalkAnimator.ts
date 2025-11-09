import { CHICKEN_IDLE_POSE, type Chicken } from '../entities/chicken';

const TWO_PI = Math.PI * 2;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export type ChickenWalkAnimator = {
  start: () => void;
  stop: () => void;
  toggle: () => void;
  update: (deltaMS: number) => void;
  isRunning: () => boolean;
};

export type ChickenWalkAnimatorOptions = {
  chicken: Chicken;
  stepsPerSecond?: number;
};

export const createChickenWalkAnimator = (
  options: ChickenWalkAnimatorOptions,
): ChickenWalkAnimator => {
  const { chicken, stepsPerSecond = 1.35 } = options;
  let elapsedMS = 0;
  let running = false;

  const liftRange = chicken.metrics.feet.liftRange * 0.85;
  const headBobRange = 5;
  const bodyBobRange = 4.5;
  const tailLiftRange = 0.08;
  const strideBias = 0.18; // keeps front leg staged forward for an isometric read

  const updatePose = (phase: number) => {
    const strideWave = Math.sin(phase);
    const bodyWave = Math.sin(phase * 2);
    const crossWave = Math.sin(phase + Math.PI / 2);

    const frontLiftWave = Math.sin(phase + Math.PI / 2);
    const backLiftWave = Math.sin(phase - Math.PI / 2);

    chicken.setPose({
      stride: clamp(strideWave + strideBias, -1, 1),
      frontFootLift: -Math.max(0, frontLiftWave) * liftRange,
      backFootLift: -Math.max(0, backLiftWave) * liftRange * 0.8,
      bodyLift: (CHICKEN_IDLE_POSE.bodyLift ?? 0) + bodyWave * bodyBobRange,
      bodyLean: (CHICKEN_IDLE_POSE.bodyLean ?? 0) + strideWave * 0.08,
      headPitch: (CHICKEN_IDLE_POSE.headPitch ?? 0) + bodyWave * 0.08,
      headBob: (CHICKEN_IDLE_POSE.headBob ?? 0) + bodyWave * headBobRange,
      headForward: Math.sin(phase) * 8,
      beakOpen: (CHICKEN_IDLE_POSE.beakOpen ?? 0.05) + Math.max(0, crossWave) * 0.08,
      wingLift: Math.sin(phase * 2) * 6,
      wingPitch: Math.sin(phase * 2) * 0.18,
      tailLift: (CHICKEN_IDLE_POSE.tailLift ?? 0) + Math.cos(phase * 2) * tailLiftRange,
      tailSplay: (CHICKEN_IDLE_POSE.tailSplay ?? 0.4) + Math.sin(phase) * 0.08,
    });
  };

  const start = () => {
    if (running) {
      return;
    }
    running = true;
    elapsedMS = 0;
  };

  const stop = () => {
    if (!running) {
      return;
    }
    running = false;
    elapsedMS = 0;
    chicken.resetPose();
  };

  const toggle = () => {
    if (running) {
      stop();
    } else {
      start();
    }
  };

  const update = (deltaMS: number) => {
    if (!running) {
      return;
    }
    elapsedMS += deltaMS;
    const phase = (elapsedMS / 1000) * stepsPerSecond * TWO_PI;
    updatePose(phase);
  };

  const isRunning = () => running;

  return { start, stop, toggle, update, isRunning };
};
