import type { ChickFollowerManager } from '../chickFollowerSystem';
import type {
  AnimatorAuthority,
  BehaviorState,
  ChickenBehaviorSystem,
} from '../chickenBehaviorSystem';

export type BehaviorControlOptions = {
  stateLock?: BehaviorState | null;
  speedMultiplier?: number;
  animatorAuthority?: AnimatorAuthority;
  followerEnabled?: boolean;
};

export type BehaviorControlHandle = {
  apply: (options: BehaviorControlOptions) => void;
  release: () => void;
  isReleased: () => boolean;
};

export type ActionBehaviorControls = {
  takeover: (options?: BehaviorControlOptions) => BehaviorControlHandle;
  releaseAll: () => void;
};

const defaultState: Required<BehaviorControlOptions> = {
  stateLock: null,
  speedMultiplier: 1,
  animatorAuthority: 'system',
  followerEnabled: true,
};

export const createActionBehaviorControls = (options: {
  behaviorSystem: ChickenBehaviorSystem;
  chickFollower: ChickFollowerManager;
}): ActionBehaviorControls => {
  const { behaviorSystem, chickFollower } = options;
  let activeHandle: BehaviorControlHandleImpl | null = null;

  const applyOptions = (next: BehaviorControlOptions) => {
    if ('stateLock' in next) {
      behaviorSystem.setStateLock(next.stateLock ?? null);
    }
    if ('speedMultiplier' in next && next.speedMultiplier !== undefined) {
      behaviorSystem.setSpeedMultiplier(next.speedMultiplier);
    }
    if ('animatorAuthority' in next && next.animatorAuthority) {
      behaviorSystem.setAnimatorAuthority(next.animatorAuthority);
    }
    if ('followerEnabled' in next && next.followerEnabled !== undefined) {
      chickFollower.setFollowingEnabled(next.followerEnabled);
    }
  };

  class BehaviorControlHandleImpl implements BehaviorControlHandle {
    private released = false;

    apply(next: BehaviorControlOptions) {
      if (this.released) {
        return;
      }
      applyOptions(next);
    }

    release() {
      if (this.released) {
        return;
      }
      this.released = true;
      if (activeHandle === this) {
        activeHandle = null;
      }
      applyOptions(defaultState);
    }

    isReleased() {
      return this.released;
    }
  }

  const takeover = (initial: BehaviorControlOptions = {}) => {
    activeHandle?.release();
    const handle = new BehaviorControlHandleImpl();
    activeHandle = handle;
    const merged = { ...defaultState, ...initial } satisfies Required<BehaviorControlOptions>;
    applyOptions(merged);
    return handle;
  };

  const releaseAll = () => {
    activeHandle?.release();
    activeHandle = null;
  };

  return {
    takeover,
    releaseAll,
  } satisfies ActionBehaviorControls;
};
