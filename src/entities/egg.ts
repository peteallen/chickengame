import { Container, Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const EGG_METRICS = {
  width: 58,
  height: 80,
  shadow: { width: 66, height: 24, offsetY: 36 },
} as const;

const SHELL_COLOR = 0xffffff;
const SHELL_OUTLINE = 0xe4e1d6;

type CrackSegment = {
  start: { x: number; y: number };
  points: { x: number; y: number }[];
};

const CRACK_SEGMENTS: CrackSegment[] = [
  {
    start: { x: -6, y: -6 },
    points: [
      { x: -12, y: -22 },
      { x: -22, y: -32 },
    ],
  },
  {
    start: { x: 4, y: -4 },
    points: [
      { x: 10, y: -18 },
      { x: 20, y: -30 },
    ],
  },
  {
    start: { x: 0, y: -2 },
    points: [
      { x: -6, y: 12 },
      { x: -2, y: 26 },
    ],
  },
];

export type Egg = {
  view: Container;
  setShake: (phase: number, strength: number) => void;
  setCrackAmount: (amount: number) => void;
  setHatchProgress: (progress: number) => void;
  destroy: () => void;
};

export const createEgg = (colors: Theme['chicken']): Egg => {
  const view = new Container();
  view.sortableChildren = true;
  view.eventMode = 'none';

  const shadow = new Graphics();
  shadow
    .ellipse(0, 0, EGG_METRICS.shadow.width / 2, EGG_METRICS.shadow.height / 2)
    .fill({ color: colors.shadow, alpha: 0.22 });
  shadow.position.y = EGG_METRICS.shadow.offsetY;
  shadow.zIndex = 0;
  view.addChild(shadow);

  const shellAnchor = new Container();
  shellAnchor.zIndex = 1;
  view.addChild(shellAnchor);

  const shell = new Graphics();
  shell
    .ellipse(0, 0, EGG_METRICS.width / 2, EGG_METRICS.height / 2)
    .fill({ color: SHELL_COLOR })
    .stroke({ color: SHELL_OUTLINE, width: 3, alpha: 0.35 });

  const cracks = new Graphics();
  cracks.alpha = 0;

  const shardLayer = new Container();
  shardLayer.zIndex = 1.05;
  shardLayer.alpha = 0;
  view.addChild(shardLayer);

  const topShard = new Graphics();
  topShard
    .moveTo(-EGG_METRICS.width * 0.32, -EGG_METRICS.height * 0.02)
    .bezierCurveTo(-EGG_METRICS.width * 0.2, -EGG_METRICS.height * 0.48, EGG_METRICS.width * 0.2, -EGG_METRICS.height * 0.5, EGG_METRICS.width * 0.32, -EGG_METRICS.height * 0.04)
    .lineTo(EGG_METRICS.width * 0.12, 0)
    .lineTo(-EGG_METRICS.width * 0.12, 0)
    .closePath()
    .fill({ color: SHELL_COLOR })
    .stroke({ color: SHELL_OUTLINE, width: 3, alpha: 0.3 });

  const bottomShard = new Graphics();
  bottomShard
    .moveTo(-EGG_METRICS.width * 0.34, 0)
    .bezierCurveTo(-EGG_METRICS.width * 0.2, EGG_METRICS.height * 0.28, EGG_METRICS.width * 0.2, EGG_METRICS.height * 0.28, EGG_METRICS.width * 0.34, 0)
    .lineTo(EGG_METRICS.width * 0.12, 0)
    .lineTo(-EGG_METRICS.width * 0.12, 0)
    .closePath()
    .fill({ color: SHELL_COLOR })
    .stroke({ color: SHELL_OUTLINE, width: 3, alpha: 0.3 });

  shardLayer.addChild(bottomShard, topShard);

  shellAnchor.addChild(shell, cracks);

  const drawCracks = (amount: number) => {
    const value = clamp(amount, 0, 1);
    cracks.clear();
    if (value <= 0) {
      cracks.alpha = 0;
      return;
    }
    cracks.alpha = clamp(0.35 + value * 0.65, 0, 1);
    const segmentsVisible = value * CRACK_SEGMENTS.length;
    CRACK_SEGMENTS.forEach((segment, index) => {
      const localProgress = clamp(segmentsVisible - index, 0, 1);
      if (localProgress <= 0) {
        return;
      }
      cracks.moveTo(segment.start.x, segment.start.y);
      segment.points.forEach((point, pointIndex) => {
        const from = pointIndex === 0 ? segment.start : segment.points[pointIndex - 1];
        const x = from.x + (point.x - from.x) * localProgress;
        const y = from.y + (point.y - from.y) * localProgress;
        cracks.lineTo(x, y);
      });
      cracks.stroke({ color: SHELL_OUTLINE, width: 2, alpha: 0.92 });
    });
  };

  const setHatchProgress = (progress: number) => {
    const value = clamp(progress, 0, 1);
    if (value <= 0) {
      shardLayer.alpha = 0;
      shellAnchor.scale.set(1);
      shellAnchor.alpha = 1;
      topShard.position.set(0, 0);
      topShard.rotation = 0;
      bottomShard.position.set(0, 0);
      bottomShard.rotation = 0;
      return;
    }
    shardLayer.alpha = value;
    const eased = Math.pow(value, 0.85);
    topShard.position.y = -EGG_METRICS.height * 0.3 - eased * 32;
    topShard.rotation = -0.15 - eased * 0.55;
    bottomShard.position.y = EGG_METRICS.height * 0.1 + eased * 18;
    bottomShard.rotation = 0.08 + eased * 0.25;
    shellAnchor.scale.set(1 + eased * 0.07, 1 - eased * 0.18);
    shellAnchor.alpha = clamp(1 - value * 1.3, 0, 1);
  };

  const setShake = (phase: number, strength: number) => {
    const magnitude = clamp(strength, 0, 1);
    const wobbleX = Math.sin(phase) * 3.2 * magnitude;
    const wobbleY = Math.sin(phase * 1.4 + Math.PI / 2) * 2.4 * magnitude;
    const twist = Math.sin(phase * 1.7) * 0.12 * magnitude;
    shellAnchor.position.set(wobbleX, wobbleY);
    shellAnchor.rotation = twist;
    shardLayer.position.set(wobbleX * 0.8, wobbleY * 0.8);
    shardLayer.rotation = twist * 0.7;
  };

  const destroy = () => {
    view.destroy({ children: true });
  };

  return {
    view,
    setShake,
    setCrackAmount: drawCracks,
    setHatchProgress,
    destroy,
  } as const;
};
