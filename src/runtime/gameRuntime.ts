import { Container, type Application } from 'pixi.js';
import type { Theme } from '../config/theme';
import type { EnvironmentConfig } from '../config/environment';
import type { PenBounds } from '../lib/geometry/penBounds';
import {
  createEnvironmentScene,
  type EnvironmentScene,
} from '../scenes/environmentScene';
import { createChicken, type Chicken } from '../entities/chicken';
import {
  createPenConstraintSystem,
  type PenConstraintSystem,
} from '../systems/penConstraintSystem';
import {
  createChickenWalkAnimator,
  type ChickenWalkAnimator,
} from '../systems/chickenWalkAnimator';
import {
  createChickenPeckAnimator,
  type ChickenPeckAnimator,
} from '../systems/chickenPeckAnimator';
import {
  createChickenFlapAnimator,
  type ChickenFlapAnimator,
} from '../systems/chickenFlapAnimator';
import {
  createChickenBehaviorSystem,
  type ChickenBehaviorSystem,
} from '../systems/chickenBehaviorSystem';
import {
  createChickenActionSystem,
  type ChickenActionSystem,
} from '../systems/chickenActionSystem';
import { createBalloonLiftAction } from '../systems/chickenActions/balloonLiftAction';
import { createDiscoPartyAction } from '../systems/chickenActions/discoPartyAction';
import { createLayEggAction } from '../systems/chickenActions/layEggAction';
import { createJetpackJoyrideAction } from '../systems/chickenActions/jetpackJoyrideAction';
import { createFireworksShowAction } from '../systems/chickenActions/fireworksShowAction';
import {
  createActionBehaviorControls,
  type ActionBehaviorControls,
} from '../systems/chickenActions/behaviorControl';
import {
  createChickFollowerManager,
  type ChickFollowerManager,
} from '../systems/chickFollowerSystem';
import {
  createRenderDepthSystem,
  type RenderDepthSystem,
} from '../systems/renderDepthSystem';
import { createDiscoRig, type DiscoRig } from '../entities/discoRig';
import { createEdmLoop, type EdmLoop } from '../lib/audio/edmLoop';
import { createDevWorkbench, type DevWorkbench } from '../ui/devWorkbench/createDevWorkbench';

const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const getPenCenter = (bounds: PenBounds) => {
  const { polygon } = bounds;
  const frontMid = midpoint(polygon.frontLeft, polygon.frontRight);
  const backMid = midpoint(polygon.backLeft, polygon.backRight);
  return midpoint(frontMid, backMid);
};

const getFrontWidth = (bounds: PenBounds) => {
  const { polygon } = bounds;
  return Math.hypot(
    polygon.frontRight.x - polygon.frontLeft.x,
    polygon.frontRight.y - polygon.frontLeft.y,
  );
};

const computeChickenScale = (bounds: PenBounds, nominalWidth: number) => {
  const frontWidth = getFrontWidth(bounds);
  const desiredWidth = frontWidth * 0.22;
  const rawScale = desiredWidth / nominalWidth;
  return Math.max(0.35, Math.min(1.35, rawScale));
};

export type RuntimeSize = { width: number; height: number };

export type RuntimeLayerRegistration = {
  key: string;
  container: Container;
  init?: () => void;
  layout?: (size: RuntimeSize) => void;
  update?: (deltaMS: number) => void;
  destroy?: () => void;
};

export type RuntimeSystemRegistration = {
  key: string;
  priority?: number;
  init?: () => void;
  update: (deltaMS: number) => void;
  destroy?: () => void;
};

export type RuntimeLayers = {
  environment: Container;
  overlay: Container;
  devtools: Container;
};

export type RuntimeServices = {
  chicken: Chicken;
  environmentScene: EnvironmentScene;
  penConstraints: PenConstraintSystem;
  behaviorSystem: ChickenBehaviorSystem;
  actionSystem: ChickenActionSystem;
  chickFollower: ChickFollowerManager;
  walkAnimator: ChickenWalkAnimator;
  peckAnimator: ChickenPeckAnimator;
  flapAnimator: ChickenFlapAnimator;
  depthSystem: RenderDepthSystem;
  behaviorControls: ActionBehaviorControls;
  overlays: { discoRig: DiscoRig };
  audio: { edmLoop: EdmLoop };
};

export type GameRuntimeContext = {
  config: {
    theme: Theme;
    environment: EnvironmentConfig;
  };
  layers: RuntimeLayers;
  services: RuntimeServices;
};

export type GameRuntimeOptions = {
  app: Application;
  root: HTMLElement;
  theme: Theme;
  environment: EnvironmentConfig;
  devMode?: boolean;
};

export type GameRuntime = {
  start: () => void;
  stop: () => void;
  update: (deltaMS: number) => void;
  layout: (size: RuntimeSize) => void;
  destroy: () => void;
  isRunning: () => boolean;
  registerLayer: (layer: RuntimeLayerRegistration) => RuntimeLayerRegistration;
  registerSystem: (system: RuntimeSystemRegistration) => RuntimeSystemRegistration;
  getLayer: (key: string) => RuntimeLayerRegistration | undefined;
  getSystem: (key: string) => RuntimeSystemRegistration | undefined;
  getContext: () => GameRuntimeContext;
};

export const createGameRuntime = (options: GameRuntimeOptions): GameRuntime => {
  const { app, root, theme, environment, devMode = false } = options;
  const layerRegistry = new Map<string, RuntimeLayerRegistration>();
  const systemRegistry = new Map<string, RuntimeSystemRegistration>();
  const systems: RuntimeSystemRegistration[] = [];
  const layoutHooks = new Set<(size: RuntimeSize) => void>();
  const disposables: Array<() => void> = [];
  let currentSize: RuntimeSize | null = null;
  let running = false;
  let destroyed = false;
  let context: GameRuntimeContext | null = null;

  const addDisposable = (cleanup: () => void) => {
    let called = false;
    const wrapped = () => {
      if (called) {
        return;
      }
      called = true;
      cleanup();
    };
    disposables.push(wrapped);
    return wrapped;
  };

  const addLayoutHook = (hook: (size: RuntimeSize) => void) => {
    layoutHooks.add(hook);
    if (currentSize) {
      hook(currentSize);
    }
    addDisposable(() => layoutHooks.delete(hook));
  };

  const registerLayer = (layer: RuntimeLayerRegistration) => {
    if (destroyed) {
      throw new Error('Cannot register layers after runtime is destroyed');
    }
    if (layerRegistry.has(layer.key)) {
      throw new Error(`Layer "${layer.key}" already registered`);
    }
    layerRegistry.set(layer.key, layer);
    app.stage.addChild(layer.container);
    if (layer.layout) {
      addLayoutHook(layer.layout);
    }
    if (running) {
      layer.init?.();
    }
    return layer;
  };

  const registerSystem = (system: RuntimeSystemRegistration) => {
    if (destroyed) {
      throw new Error('Cannot register systems after runtime is destroyed');
    }
    if (systemRegistry.has(system.key)) {
      throw new Error(`System "${system.key}" already registered`);
    }
    systemRegistry.set(system.key, system);
    systems.push(system);
    systems.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    if (running) {
      system.init?.();
    }
    return system;
  };

  const getLayer = (key: string) => layerRegistry.get(key);
  const getSystem = (key: string) => systemRegistry.get(key);

  const layout = (size: RuntimeSize) => {
    if (destroyed) {
      return;
    }
    currentSize = size;
    layoutHooks.forEach((hook) => hook(size));
  };

  const update = (deltaMS: number) => {
    if (!running || destroyed) {
      return;
    }
    layerRegistry.forEach((layer) => {
      layer.update?.(deltaMS);
    });
    systems.forEach((system) => {
      system.update(deltaMS);
    });
  };

  const start = () => {
    if (destroyed || running) {
      return;
    }
    running = true;
    layerRegistry.forEach((layer) => layer.init?.());
    systems.forEach((system) => system.init?.());
  };

  const stop = () => {
    if (!running) {
      return;
    }
    running = false;
  };

  const destroy = () => {
    if (destroyed) {
      return;
    }
    stop();
    systems
      .slice()
      .reverse()
      .forEach((system) => system.destroy?.());
    layerRegistry.forEach((layer) => {
      layer.destroy?.();
      layer.container.parent?.removeChild(layer.container);
    });
    disposables.forEach((dispose) => dispose());
    layerRegistry.clear();
    systemRegistry.clear();
    systems.length = 0;
    layoutHooks.clear();
    disposables.length = 0;
    destroyed = true;
  };

  /**
   * Default runtime wiring — constructing the environment, systems, and dev tooling.
   */
  const environmentScene = createEnvironmentScene(theme, environment);
  const overlayLayer = new Container();
  overlayLayer.eventMode = 'none';
  overlayLayer.sortableChildren = true;
  const devLayer = new Container();
  devLayer.visible = devMode;
  devLayer.sortableChildren = true;

  registerLayer({
    key: 'environment',
    container: environmentScene.container,
    layout: ({ width, height }) => environmentScene.layout({ width, height }),
    update: (deltaMS) => environmentScene.update(deltaMS),
  });

  registerLayer({
    key: 'overlay',
    container: overlayLayer,
  });

  registerLayer({
    key: 'devtools',
    container: devLayer,
    destroy: () => devLayer.destroy({ children: true }),
  });

  const depthSystem = createRenderDepthSystem();
  const discoRig = createDiscoRig();
  overlayLayer.addChild(discoRig.view);

  const edmLoop = createEdmLoop();

  const chicken = createChicken(theme.chicken);
  environmentScene.penLayer.addChild(chicken.view);
  depthSystem.register({
    target: chicken.view,
    layer: 1,
    getDepth: () =>
      chicken.view.position.y +
      chicken.metrics.feet.groundY * Math.abs(chicken.view.scale.y),
    bias: 0.2,
  });

  const walkAnimator = createChickenWalkAnimator({ chicken });
  const peckAnimator = createChickenPeckAnimator({ chicken });
  const flapAnimator = createChickenFlapAnimator({ chicken });

  const behaviorSystem = createChickenBehaviorSystem({
    chicken,
    walkAnimator,
    peckAnimator,
    flapAnimator,
    getPenBounds: environmentScene.getPenBounds,
  });

  const penConstraintSystem = createPenConstraintSystem({
    getPenBounds: environmentScene.getPenBounds,
    defaultBehavior: environment.constraints.defaultBehavior,
    bounceDamping: environment.constraints.bounceDamping,
    clampVelocityMultiplier: environment.constraints.clampVelocityMultiplier,
  });

  penConstraintSystem.register({
    target: chicken.view,
    mode: 'pen',
    behavior: 'clamp',
  });

  const chickFollower = createChickFollowerManager({
    environmentScene,
    penConstraints: penConstraintSystem,
    theme,
    depthSystem,
  });

  const behaviorControls = createActionBehaviorControls({
    behaviorSystem,
    chickFollower,
  });

  const actions = [
    createBalloonLiftAction(),
    createDiscoPartyAction(),
    createLayEggAction(),
    createJetpackJoyrideAction(),
    createFireworksShowAction(),
  ];

  const actionSystem = createChickenActionSystem({
    context: {
      chicken,
      behaviorSystem,
      walkAnimator,
      peckAnimator,
      flapAnimator,
      environmentScene,
      penConstraints: penConstraintSystem,
      theme,
      chickFollower,
      depthSystem,
      behaviorControls,
      layers: { overlay: overlayLayer },
      overlays: { discoRig },
      audio: { edmLoop },
    },
    actions,
  });

  const handleChickenTap = () => {
    actionSystem.triggerRandomAction();
  };
  chicken.view.on('pointertap', handleChickenTap);
  addDisposable(() => chicken.view.off('pointertap', handleChickenTap));

  const detachPenListener = environmentScene.onPenBoundsChanged((bounds) => {
    discoRig.setPenBounds(bounds);
    const center = getPenCenter(bounds);
    chicken.view.position.set(center.x, center.y);
    const scale = computeChickenScale(bounds, chicken.metrics.referenceWidth);
    chicken.setScale(scale);
  });
  addDisposable(detachPenListener);

  addLayoutHook(({ width, height }) => {
    discoRig.layout({ width, height });
  });

  registerSystem({
    key: 'pen-constraints',
    priority: 10,
    update: (deltaMS) => penConstraintSystem.update(deltaMS),
    destroy: () => penConstraintSystem.clear(),
  });

  registerSystem({
    key: 'walk-animator',
    priority: 20,
    update: (deltaMS) => walkAnimator.update(deltaMS),
  });

  registerSystem({
    key: 'peck-animator',
    priority: 30,
    update: (deltaMS) => peckAnimator.update(deltaMS),
  });

  registerSystem({
    key: 'flap-animator',
    priority: 40,
    update: (deltaMS) => flapAnimator.update(deltaMS),
  });

  registerSystem({
    key: 'behavior-system',
    priority: 50,
    update: (deltaMS) => behaviorSystem.update(deltaMS),
    destroy: () => behaviorSystem.destroy(),
  });

  registerSystem({
    key: 'action-system',
    priority: 60,
    update: (deltaMS) => actionSystem.update(deltaMS),
    destroy: () => actionSystem.destroy(),
  });

  registerSystem({
    key: 'chick-follower',
    priority: 70,
    update: (deltaMS) => chickFollower.update(deltaMS),
    destroy: () => chickFollower.destroy(),
  });

  registerSystem({
    key: 'disco-rig',
    priority: 80,
    update: (deltaMS) => discoRig.update(deltaMS),
    destroy: () => discoRig.destroy(),
  });

  registerSystem({
    key: 'depth-system',
    priority: 90,
    update: () => depthSystem.update(),
    destroy: () => depthSystem.clear(),
  });

  let devWorkbench: DevWorkbench | null = null;
  if (devMode) {
    const initialSize =
      currentSize ?? { width: app.renderer.width, height: app.renderer.height };
    devWorkbench = createDevWorkbench({
      layer: devLayer,
      root,
      theme,
      initialSize,
    });
    addLayoutHook((size) => {
      devWorkbench?.layout(size);
    });
    registerSystem({
      key: 'dev-workbench',
      priority: 100,
      update: (deltaMS) => devWorkbench?.update(deltaMS),
      destroy: () => devWorkbench?.destroy(),
    });
  }

  context = {
    config: { theme, environment },
    layers: {
      environment: environmentScene.container,
      overlay: overlayLayer,
      devtools: devLayer,
    },
    services: {
      chicken,
      environmentScene,
      penConstraints: penConstraintSystem,
      behaviorSystem,
      actionSystem,
      chickFollower,
      walkAnimator,
      peckAnimator,
      flapAnimator,
      depthSystem,
      behaviorControls,
      overlays: { discoRig },
      audio: { edmLoop },
    },
  };

  addDisposable(() => {
    edmLoop.stop();
  });

  return {
    start,
    stop,
    update,
    layout,
    destroy,
    isRunning: () => running,
    registerLayer,
    registerSystem,
    getLayer,
    getSystem,
    getContext: () => {
      if (!context) {
        throw new Error('Runtime context is not initialized');
      }
      return context;
    },
  };
};
