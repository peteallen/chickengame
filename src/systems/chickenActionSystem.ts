import type { Container } from 'pixi.js';
import type { Chicken } from '../entities/chicken';
import type { ChickenBehaviorSystem } from './chickenBehaviorSystem';
import type { ChickenWalkAnimator } from './chickenWalkAnimator';
import type { ChickenPeckAnimator } from './chickenPeckAnimator';
import type { ChickenFlapAnimator } from './chickenFlapAnimator';
import type { EnvironmentScene } from '../scenes/environmentScene';
import type { DiscoRig } from '../entities/discoRig';
import type { EdmLoop } from '../lib/audio/edmLoop';
import type { PenConstraintSystem } from './penConstraintSystem';
import type { Theme } from '../config/theme';
import type { ChickFollowerManager } from './chickFollowerSystem';
import type { RenderDepthSystem } from './renderDepthSystem';
import type { ActionBehaviorControls } from './chickenActions/behaviorControl';

export type ChickenActionContext = {
  chicken: Chicken;
  behaviorSystem: ChickenBehaviorSystem;
  walkAnimator: ChickenWalkAnimator;
  peckAnimator: ChickenPeckAnimator;
  flapAnimator: ChickenFlapAnimator;
  environmentScene: EnvironmentScene;
  penConstraints: PenConstraintSystem;
  theme: Theme;
  chickFollower: ChickFollowerManager;
  depthSystem: RenderDepthSystem;
  behaviorControls: ActionBehaviorControls;
  layers: {
    overlay: Container;
  };
  overlays: {
    discoRig: DiscoRig;
  };
  audio: {
    edmLoop: EdmLoop;
  };
};

export type ChickenActionInstance = {
  durationMS: number;
  onEnter?: () => void;
  onUpdate?: (deltaMS: number, elapsedMS: number, progress: number) => void;
  onExit?: () => void;
};

export type ChickenActionDefinition = {
  id: string;
  weight?: number;
  isAvailable?: () => boolean;
  create: (context: ChickenActionContext) => ChickenActionInstance;
};

export type ChickenActionSystem = {
  update: (deltaMS: number) => void;
  triggerRandomAction: () => boolean;
  isActionActive: () => boolean;
  destroy: () => void;
};

type ActiveAction = {
  definition: ChickenActionDefinition;
  instance: ChickenActionInstance;
  elapsed: number;
};

const chooseAction = (actions: ChickenActionDefinition[]): ChickenActionDefinition | null => {
  if (!actions.length) {
    return null;
  }
  const totalWeight = actions.reduce((sum, action) => sum + (action.weight ?? 1), 0);
  let roll = Math.random() * totalWeight;
  for (const action of actions) {
    roll -= action.weight ?? 1;
    if (roll <= 0) {
      return action;
    }
  }
  return actions[actions.length - 1] ?? null;
};

export const createChickenActionSystem = (
  options: {
    actions: ChickenActionDefinition[];
    context: ChickenActionContext;
  },
): ChickenActionSystem => {
  const { actions, context } = options;
  let current: ActiveAction | null = null;
  let lastActionId: string | null = null;

  const triggerRandomAction = (): boolean => {
    if (current) {
      return false;
    }
    const available = actions.filter((action) => (action.isAvailable?.() ?? true));
    const filtered =
      lastActionId && available.length > 1
        ? available.filter((action) => action.id !== lastActionId)
        : available;
    const pool = filtered.length > 0 ? filtered : available;
    const chosen = chooseAction(pool);
    if (!chosen) {
      return false;
    }
    const instance = chosen.create(context);
    if (!instance || !Number.isFinite(instance.durationMS) || instance.durationMS <= 0) {
      return false;
    }
    context.behaviorControls.releaseAll();
    current = { definition: chosen, instance, elapsed: 0 };
    current.instance.onEnter?.();
    return true;
  };

  const update = (deltaMS: number) => {
    if (!current) {
      return;
    }
    current.elapsed += deltaMS;
    const { instance, elapsed } = current;
    const progress = Math.min(1, elapsed / instance.durationMS);
    instance.onUpdate?.(deltaMS, elapsed, progress);
    if (elapsed >= instance.durationMS) {
      instance.onExit?.();
      lastActionId = current.definition.id;
      context.behaviorControls.releaseAll();
      current = null;
    }
  };

  const destroy = () => {
    if (!current) {
      context.behaviorControls.releaseAll();
      return;
    }
    current.instance.onExit?.();
    lastActionId = current.definition.id;
    current = null;
    context.behaviorControls.releaseAll();
  };

  const isActionActive = () => Boolean(current);

  return { update, triggerRandomAction, isActionActive, destroy };
};
