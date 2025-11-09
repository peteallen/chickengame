import { Container, type Ticker } from 'pixi.js';
import { environment, theme } from '../config';
import { createChicken } from '../entities/chicken';
import type { PenBounds } from '../lib/geometry/penBounds';
import { createEnvironmentScene } from '../scenes/environmentScene';
import { createPenConstraintSystem } from '../systems/penConstraintSystem';
import { createChickenWalkAnimator } from '../systems/chickenWalkAnimator';
import { createChickenPeckAnimator } from '../systems/chickenPeckAnimator';
import { createChickenFlapAnimator } from '../systems/chickenFlapAnimator';
import { createChickenBehaviorSystem } from '../systems/chickenBehaviorSystem';
import { createChickenActionSystem } from '../systems/chickenActionSystem';
import { createDiscoPartyAction } from '../systems/chickenActions/discoPartyAction';
import { createLayEggAction } from '../systems/chickenActions/layEggAction';
import { createChickFollowerManager } from '../systems/chickFollowerSystem';
import { createDiscoRig } from '../entities/discoRig';
import { createEdmLoop } from '../lib/audio/edmLoop';
import { createPixiApp, initPixiApp } from './pixiApp';

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

export const bootstrap = async () => {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    throw new Error('Unable to find #app container');
  }

  const app = createPixiApp();
  await initPixiApp(app, {
    background: theme.sky,
    resizeTo: window,
  });

  root.replaceChildren(app.canvas);

  const environmentScene = createEnvironmentScene(theme, environment);
  const overlayLayer = new Container();
  overlayLayer.eventMode = 'none';
  overlayLayer.sortableChildren = true;
  app.stage.addChild(environmentScene.container, overlayLayer);

  const discoRig = createDiscoRig();
  overlayLayer.addChild(discoRig.view);

  const edmLoop = createEdmLoop();

  const chicken = createChicken(theme.chicken);
  environmentScene.penLayer.addChild(chicken.view);

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
  });

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
      overlays: { discoRig },
      audio: { edmLoop },
    },
    actions: [createDiscoPartyAction(), createLayEggAction()],
  });

  const handleChickenTap = () => {
    actionSystem.triggerRandomAction();
  };
  chicken.view.on('pointertap', handleChickenTap);

  const detachPenListener = environmentScene.onPenBoundsChanged((bounds) => {
    const center = getPenCenter(bounds);
    chicken.view.position.set(center.x, center.y);
    const scale = computeChickenScale(bounds, chicken.metrics.referenceWidth);
    chicken.setScale(scale);
  });

  const handleTick = (ticker: Ticker) => {
    penConstraintSystem.update(ticker.deltaMS);
    walkAnimator.update(ticker.deltaMS);
    peckAnimator.update(ticker.deltaMS);
    flapAnimator.update(ticker.deltaMS);
    behaviorSystem.update(ticker.deltaMS);
    actionSystem.update(ticker.deltaMS);
    chickFollower.update(ticker.deltaMS);
    discoRig.update(ticker.deltaMS);
  };
  app.ticker.add(handleTick);

  const handleResize = () => {
    environmentScene.layout({
      width: app.renderer.width,
      height: app.renderer.height,
    });
    discoRig.layout({
      width: app.renderer.width,
      height: app.renderer.height,
    });
  };

  handleResize();
  window.addEventListener('resize', handleResize);

  return {
    app,
    penConstraintSystem,
    destroy: () => {
      detachPenListener();
      window.removeEventListener('resize', handleResize);
      app.ticker.remove(handleTick);
      chicken.view.off('pointertap', handleChickenTap);
      penConstraintSystem.clear();
      behaviorSystem.destroy();
      actionSystem.destroy();
      chickFollower.destroy();
      discoRig.destroy();
      edmLoop.stop();
    },
  } as const;
};
