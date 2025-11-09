import { CHICKEN_IDLE_POSE, type Chicken } from '../entities/chicken';

const TWO_PI = Math.PI * 2;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export type ChickenFlapAnimator = {
  start: () => void;
  stop: () => void;
  toggle: () => void;
  update: (deltaMS: number) => void;
  isRunning: () => boolean;
};

export type ChickenFlapAnimatorOptions = {
  chicken: Chicken;
  beatsPerSecond?: number;
  wingLiftRange?: number;
  wingPitchRange?: number;
  bodyBobRange?: number;
};

export const createChickenFlapAnimator = ({
  chicken,
  beatsPerSecond = 2.1,
  wingLiftRange = 28,
  wingPitchRange = 0.55,
  bodyBobRange = 10,
}: ChickenFlapAnimatorOptions): ChickenFlapAnimator => {
  let elapsed = 0;
  let running = false;

  const updatePose = (phase: number) => {
    const wingLift = Math.sin(phase) * wingLiftRange;
    const wingPitch = Math.cos(phase) * wingPitchRange;
    const flutter = Math.sin(phase * 2);
    const bodyBob = Math.sin(phase) * bodyBobRange;
    const headTilt = Math.sin(phase + Math.PI / 3) * 0.3;

    chicken.setPose({
      wingLift,
      wingPitch,
      bodyLift: (CHICKEN_IDLE_POSE.bodyLift ?? 0) + bodyBob * 0.5,
      bodyLean: (CHICKEN_IDLE_POSE.bodyLean ?? 0) + flutter * 0.08,
      headPitch: (CHICKEN_IDLE_POSE.headPitch ?? 0) + headTilt,
      headBob: (CHICKEN_IDLE_POSE.headBob ?? 0) - bodyBob * 0.35,
      tailLift: (CHICKEN_IDLE_POSE.tailLift ?? 0) + clamp(wingLift / 40, -0.15, 0.25),
      tailSplay: (CHICKEN_IDLE_POSE.tailSplay ?? 0.4) + Math.abs(wingLift) / 160,
      beakOpen: (CHICKEN_IDLE_POSE.beakOpen ?? 0.05) + Math.max(0, flutter) * 0.08,
      frontFootLift: Math.sin(phase * 0.5) * 6,
      backFootLift: Math.sin(phase * 0.5 + Math.PI / 6) * 6,
      stride: Math.sin(phase * 0.5) * 0.2,
    });
  };

  const start = () => {
    if (running) {
      return;
    }
    running = true;
    elapsed = 0;
  };

  const stop = () => {
    if (!running) {
      return;
    }
    running = false;
    elapsed = 0;
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
    elapsed += deltaMS;
    const phase = (elapsed / 1000) * beatsPerSecond * TWO_PI;
    updatePose(phase);
  };

  const isRunning = () => running;

  return { start, stop, toggle, update, isRunning };
};
