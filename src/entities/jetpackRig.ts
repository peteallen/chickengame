import { Container, Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const createTank = (color: number) => {
  const tank = new Graphics();
  const width = 32;
  const height = 68;
  tank
    .roundRect(-width / 2, -height / 2, width, height, 10)
    .fill({ color, alpha: 0.95 })
    .stroke({ color: 0x1c1d24, width: 3, alpha: 0.65 });
  return tank;
};

const createFlame = (baseColor: number) => {
  const flame = new Graphics();
  flame
    .moveTo(0, 0)
    .bezierCurveTo(8, 12, 8, 24, 0, 46)
    .bezierCurveTo(-8, 24, -8, 12, 0, 0)
    .fill({ color: baseColor, alpha: 0.85 });
  flame.pivot.set(0, 0);
  flame.position.set(0, 32);
  flame.alpha = 0;
  return flame;
};

export type JetpackRig = {
  view: Container;
  setThrottle: (value: number) => void;
  update: (deltaMS: number) => void;
  destroy: () => void;
};

export const createJetpackRig = (options: { theme: Theme }): JetpackRig => {
  const { theme } = options;
  const view = new Container();
  view.sortableChildren = true;

  const strap = new Graphics();
  strap
    .roundRect(-54, -18, 108, 36, 18)
    .fill({ color: 0x4c3d3f, alpha: 0.8 })
    .stroke({ color: 0x332323, width: 6, alpha: 0.5 });
  strap.position.set(0, -8);
  strap.zIndex = 0.5;

  const leftTank = createTank(0x9aa0b5);
  const rightTank = createTank(0x7b8198);
  leftTank.zIndex = 0.6;
  rightTank.zIndex = 0.6;
  leftTank.position.set(-34, 8);
  rightTank.position.set(34, 8);

  const leftFlame = createFlame(theme.chicken.wattle);
  const rightFlame = createFlame(theme.chicken.comb);
  leftFlame.zIndex = 0.3;
  rightFlame.zIndex = 0.3;
  leftFlame.position.x = -34;
  rightFlame.position.x = 34;

  const nozzleLeft = new Graphics();
  nozzleLeft
    .roundRect(-10, 0, 20, 16, 6)
    .fill({ color: 0x2d2e38, alpha: 0.95 });
  nozzleLeft.position.set(-34, 28);

  const nozzleRight = new Graphics();
  nozzleRight
    .roundRect(-10, 0, 20, 16, 6)
    .fill({ color: 0x2d2e38, alpha: 0.95 });
  nozzleRight.position.set(34, 28);

  view.addChild(leftFlame, rightFlame, strap, leftTank, rightTank, nozzleLeft, nozzleRight);

  let throttle = 0;
  let time = 0;

  const setThrottle = (value: number) => {
    throttle = clamp01(value);
  };

  const update = (deltaMS: number) => {
    time += deltaMS;
    const pulse = Math.sin(time * 0.01) * 0.15;
    const length = 1 + throttle * 1.6 + pulse * throttle;
    const alpha = throttle * 0.9 + 0.1;
    [leftFlame, rightFlame].forEach((flame, index) => {
      const jitter = Math.sin(time * 0.02 + index) * 0.08;
      flame.scale.set(0.7 + throttle * 0.5 + jitter * throttle, length);
      flame.alpha = clamp01(alpha + jitter * 0.3);
    });
  };

  const destroy = () => {
    view.destroy({ children: true });
  };

  return { view, setThrottle, update, destroy };
};
