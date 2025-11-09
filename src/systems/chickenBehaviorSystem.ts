import type { Container } from 'pixi.js';
import type { Chicken } from '../entities/chicken';
import type { ChickenWalkAnimator } from './chickenWalkAnimator';
import type { ChickenPeckAnimator } from './chickenPeckAnimator';
import type { ChickenFlapAnimator } from './chickenFlapAnimator';
import type { PenBounds } from '../lib/geometry/penBounds';
import { clampPointToPen, clampPointToFootprint, isPointInsidePen } from '../lib/geometry/penBounds';

const randomRange = (min: number, max: number) => min + Math.random() * (max - min);
const randomInt = (min: number, max: number) => Math.floor(randomRange(min, max + 1));

export type BehaviorState = 'idle' | 'walk' | 'peck' | 'flap';

export type AnimatorAuthority = 'system' | 'external';

type ChickenBehaviorSystemOptions = {
  chicken: Chicken;
  walkAnimator: ChickenWalkAnimator;
  peckAnimator: ChickenPeckAnimator;
  flapAnimator: ChickenFlapAnimator;
  getPenBounds: () => PenBounds | null;
};

type WalkContext = {
  target: { x: number; y: number };
  speed: number;
};

const chooseNextState = (): BehaviorState => {
  const roll = Math.random();
  if (roll < 0.5) {
    return 'walk';
  }
  if (roll < 0.7) {
    return 'idle';
  }
  if (roll < 0.9) {
    return 'peck';
  }
  return 'flap';
};

const stateDurationFor = (state: BehaviorState): number => {
  switch (state) {
    case 'walk':
      return randomRange(4000, 9000);
    case 'peck':
      return randomRange(5000, 9000);
    case 'flap':
      return randomRange(2500, 5000);
    case 'idle':
    default:
      return randomRange(1200, 3200);
  }
};

const pickRandomPointInPen = (bounds: PenBounds): { x: number; y: number } => {
  const { footprint } = bounds;
  const candidate = {
    x: randomRange(footprint.minX, footprint.maxX),
    y: randomRange(footprint.minY, footprint.maxY),
  };
  if (isPointInsidePen(candidate, bounds)) {
    return candidate;
  }
  return clampPointToPen(candidate, bounds);
};

const faceTowards = (view: Container, dx: number, chicken: Chicken) => {
  if (Math.abs(dx) < 0.5) {
    return;
  }
  chicken.setFacing(dx >= 0 ? 'right' : 'left');
};

export type ChickenBehaviorSystem = {
  update: (deltaMS: number) => void;
  destroy: () => void;
  setSpeedMultiplier: (multiplier: number) => void;
  setStateLock: (state: BehaviorState | null) => void;
  setAnimatorAuthority: (authority: AnimatorAuthority) => void;
};

export const createChickenBehaviorSystem = ({
  chicken,
  walkAnimator,
  peckAnimator,
  flapAnimator,
  getPenBounds,
}: ChickenBehaviorSystemOptions): ChickenBehaviorSystem => {
  let state: BehaviorState = 'idle';
  let stateElapsed = 0;
  let stateDuration = stateDurationFor(state);
  let walkContext: WalkContext | null = null;
  let speedMultiplier = 1;
  let stateLock: BehaviorState | null = null;
  let animatorAuthority: AnimatorAuthority = 'system';

  const stopAllAnimators = (force = false) => {
    if (animatorAuthority !== 'system' && !force) {
      return;
    }
    walkAnimator.stop();
    peckAnimator.stop();
    flapAnimator.stop();
  };

  const enterState = (next: BehaviorState, options?: { forceAnimatorControl?: boolean }) => {
    const controlAnimators = animatorAuthority === 'system' || options?.forceAnimatorControl === true;
    if (controlAnimators) {
      stopAllAnimators(options?.forceAnimatorControl === true);
    }
    state = next;
    stateElapsed = 0;
    stateDuration = stateDurationFor(next);
    if (next !== 'walk') {
      walkContext = null;
    }

    if (!controlAnimators) {
      return;
    }

    switch (next) {
      case 'walk':
        walkAnimator.start();
        walkContext = null;
        break;
      case 'peck':
        peckAnimator.start();
        break;
      case 'flap':
        flapAnimator.start();
        break;
      case 'idle':
      default:
        chicken.resetPose();
        break;
    }
  };

  const ensureWalkContext = () => {
    const bounds = getPenBounds();
    if (!bounds) {
      return;
    }
    const target = pickRandomPointInPen(bounds);
    const speed = randomRange(65, 120);
    walkContext = { target, speed };
  };

  const updateWalk = (deltaMS: number) => {
    if (!walkContext) {
      ensureWalkContext();
      return;
    }

    const bounds = getPenBounds();
    if (!bounds) {
      return;
    }

    const position = chicken.view.position;
    const dx = walkContext.target.x - position.x;
    const dy = walkContext.target.y - position.y;
    const distance = Math.hypot(dx, dy);
    const step = (walkContext.speed * speedMultiplier * deltaMS) / 1000;

    if (distance < 4) {
      ensureWalkContext();
      return;
    }

    const ratio = step >= distance ? 1 : step / distance;
    position.set(position.x + dx * ratio, position.y + dy * ratio);
    const clamped = clampPointToFootprint(position, bounds);
    position.set(clamped.x, clamped.y);
    faceTowards(chicken.view, dx, chicken);
  };

  const updateState = (deltaMS: number) => {
    if (state === 'walk') {
      updateWalk(deltaMS);
    }
  };

  const update = (deltaMS: number) => {
    if (stateLock && state !== stateLock) {
      enterState(stateLock);
    }

    stateElapsed += deltaMS;
    updateState(deltaMS);
    if (!stateLock && stateElapsed >= stateDuration) {
      enterState(chooseNextState());
    }
  };

  const destroy = () => {
    stopAllAnimators(true);
  };

  const setSpeedMultiplier = (multiplier: number) => {
    if (!Number.isFinite(multiplier)) {
      return;
    }
    speedMultiplier = Math.max(0, multiplier);
  };

  const setStateLock = (lock: BehaviorState | null) => {
    stateLock = lock;
    if (stateLock && state !== stateLock) {
      enterState(stateLock);
    }
    if (!stateLock) {
      stateElapsed = 0;
      stateDuration = stateDurationFor(state);
    }
  };

  const setAnimatorAuthority = (authority: AnimatorAuthority) => {
    if (animatorAuthority === authority) {
      return;
    }
    animatorAuthority = authority;
    if (authority === 'external') {
      stopAllAnimators(true);
      return;
    }
    enterState(state, { forceAnimatorControl: true });
  };

  // kick things off with a walk so she starts exploring
  enterState('walk');

  return { update, destroy, setSpeedMultiplier, setStateLock, setAnimatorAuthority };
};
