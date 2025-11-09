import { CHICKEN_IDLE_POSE, type Chicken } from '../entities/chicken';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const randomRange = (min: number, max: number) => min + Math.random() * (max - min);
const randomInt = (min: number, max: number) => Math.floor(randomRange(min, max + 1));
const easeInQuad = (t: number) => t * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type Phase = 'rest' | 'lookDown' | 'peck' | 'lookUp';

type State = {
  phase: Phase;
  elapsed: number;
  duration: number;
  pecksTarget: number;
  pecksCompleted: number;
  peckElapsed: number;
};

type TimingConfig = {
  minPecks: number;
  maxPecks: number;
  minRestMS: number;
  maxRestMS: number;
  lookDownMS: number;
  lookUpMS: number;
  peckDownMS: number;
  peckHoldMS: number;
  peckUpMS: number;
};

export type ChickenPeckAnimatorOptions = {
  chicken: Chicken;
  timings?: Partial<TimingConfig>;
};

const DEFAULT_TIMINGS: TimingConfig = {
  minPecks: 1,
  maxPecks: 5,
  minRestMS: 1000,
  maxRestMS: 10000,
  lookDownMS: 180,
  lookUpMS: 260,
  peckDownMS: 90,
  peckHoldMS: 36,
  peckUpMS: 130,
};

const BETWEEN_PECK_BEND = 0.4;

const applyBentPose = (chicken: Chicken, bend: number) => {
  const eased = clamp(bend, 0, 1);
  const mellow = Math.pow(eased, 0.92);
  chicken.setPose({
    bodyLean: (CHICKEN_IDLE_POSE.bodyLean ?? 0) + mellow * 0.52,
    bodyLift: (CHICKEN_IDLE_POSE.bodyLift ?? 0) + mellow * 22,
    headPitch: (CHICKEN_IDLE_POSE.headPitch ?? 0) + mellow * 1.2,
    headBob: (CHICKEN_IDLE_POSE.headBob ?? 0) + mellow * 68,
    headForward: mellow * 30,
    beakOpen: (CHICKEN_IDLE_POSE.beakOpen ?? 0.05) + mellow * 0.32,
    wingLift: clamp(-6 + mellow * 24, -14, 24),
    wingPitch: mellow * 0.2,
    tailLift: (CHICKEN_IDLE_POSE.tailLift ?? 0) - mellow * 0.12,
    tailSplay: (CHICKEN_IDLE_POSE.tailSplay ?? 0.4) + mellow * 0.07,
    stride: 0,
    frontFootLift: mellow * 7,
    backFootLift: mellow * 10,
  });
};

const applyRestPose = (chicken: Chicken, elapsed: number, duration: number) => {
  const cycle = duration > 0 ? elapsed / duration : 0;
  const wobble = Math.sin(cycle * Math.PI * 2);
  const bob = Math.sin(cycle * Math.PI * 4);
  chicken.setPose({
    bodyLean: (CHICKEN_IDLE_POSE.bodyLean ?? 0) - 0.05 + wobble * 0.05,
    bodyLift: (CHICKEN_IDLE_POSE.bodyLift ?? 0) - 2,
    headPitch: (CHICKEN_IDLE_POSE.headPitch ?? 0) - 0.12 + wobble * 0.2,
    headBob: (CHICKEN_IDLE_POSE.headBob ?? 0) - 6 + bob * 2,
    headForward: wobble * 6,
    beakOpen: (CHICKEN_IDLE_POSE.beakOpen ?? 0.05) + Math.max(0, wobble) * 0.04,
    wingLift: wobble * 6,
    wingPitch: wobble * 0.1,
    tailLift: (CHICKEN_IDLE_POSE.tailLift ?? 0) + wobble * 0.04,
    tailSplay: (CHICKEN_IDLE_POSE.tailSplay ?? 0.4) + wobble * 0.03,
    stride: 0,
    frontFootLift: 0,
    backFootLift: 0,
  });
};

const computePeckBend = (timeMS: number, config: TimingConfig) => {
  if (timeMS < config.peckDownMS) {
    const t = clamp(timeMS / config.peckDownMS, 0, 1);
    const eased = Math.sin((t * Math.PI) / 2); // fast but smooth ease-out curve
    return Math.pow(eased, 0.92);
  }

  const downCutoff = config.peckDownMS;
  const holdCutoff = downCutoff + config.peckHoldMS;
  if (timeMS < holdCutoff) {
    return 1;
  }

  const upProgress = clamp((timeMS - holdCutoff) / config.peckUpMS, 0, 1);
  const eased = easeOutCubic(upProgress);
  return 1 - (1 - BETWEEN_PECK_BEND) * eased;
};

export type ChickenPeckAnimator = {
  start: () => void;
  stop: () => void;
  toggle: () => void;
  update: (deltaMS: number) => void;
  isRunning: () => boolean;
};

export const createChickenPeckAnimator = ({
  chicken,
  timings = {},
}: ChickenPeckAnimatorOptions): ChickenPeckAnimator => {
  const config: TimingConfig = { ...DEFAULT_TIMINGS, ...timings };
  const singlePeckDuration = config.peckDownMS + config.peckHoldMS + config.peckUpMS;

  const state: State = {
    phase: 'rest',
    elapsed: 0,
    duration: randomRange(config.minRestMS, config.maxRestMS),
    pecksTarget: 0,
    pecksCompleted: 0,
    peckElapsed: 0,
  };

  let running = false;

  const enterRest = () => {
    state.phase = 'rest';
    state.elapsed = 0;
    state.duration = randomRange(config.minRestMS, config.maxRestMS);
    state.pecksCompleted = 0;
    state.pecksTarget = 0;
    state.peckElapsed = 0;
  };

  const enterLookDown = () => {
    state.phase = 'lookDown';
    state.elapsed = 0;
    state.duration = config.lookDownMS;
  };

  const enterPeck = () => {
    state.phase = 'peck';
    state.elapsed = 0;
    state.peckElapsed = 0;
    state.pecksCompleted = 0;
    const minPecks = Math.max(1, Math.min(config.minPecks, config.maxPecks));
    const maxPecks = Math.max(minPecks, config.maxPecks);
    state.pecksTarget = randomInt(minPecks, maxPecks);
  };

  const enterLookUp = () => {
    state.phase = 'lookUp';
    state.elapsed = 0;
    state.duration = config.lookUpMS;
  };

  const updateLookDown = (deltaMS: number) => {
    state.elapsed += deltaMS;
    const progress = clamp(state.elapsed / state.duration, 0, 1);
    applyBentPose(chicken, Math.pow(progress, 0.8));
    if (state.elapsed >= state.duration) {
      enterPeck();
    }
  };

  const updateLookUp = (deltaMS: number) => {
    state.elapsed += deltaMS;
    const progress = clamp(state.elapsed / state.duration, 0, 1);
    applyBentPose(chicken, 1 - progress);
    if (state.elapsed >= state.duration) {
      enterRest();
    }
  };

  const updatePeck = (deltaMS: number) => {
    state.peckElapsed += deltaMS;
    if (state.peckElapsed >= singlePeckDuration) {
      const completed = Math.floor(state.peckElapsed / singlePeckDuration);
      state.pecksCompleted += completed;
      state.peckElapsed = state.peckElapsed % singlePeckDuration;
      if (state.pecksCompleted >= state.pecksTarget) {
        enterLookUp();
        return;
      }
    }

    const bend = computePeckBend(state.peckElapsed, config);
    applyBentPose(chicken, bend);
  };

  const updateRest = (deltaMS: number) => {
    state.elapsed += deltaMS;
    applyRestPose(chicken, state.elapsed, state.duration);
    if (state.elapsed >= state.duration) {
      enterLookDown();
    }
  };

  const updatePhase = (deltaMS: number) => {
    switch (state.phase) {
      case 'rest':
        updateRest(deltaMS);
        break;
      case 'lookDown':
        updateLookDown(deltaMS);
        break;
      case 'peck':
        updatePeck(deltaMS);
        break;
      case 'lookUp':
        updateLookUp(deltaMS);
        break;
    }
  };

  const start = () => {
    if (running) {
      return;
    }
    running = true;
    enterLookDown();
  };

  const stop = () => {
    if (!running) {
      return;
    }
    running = false;
    chicken.resetPose();
    enterRest();
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
    updatePhase(deltaMS);
  };

  const isRunning = () => running;

  return { start, stop, toggle, update, isRunning };
};
