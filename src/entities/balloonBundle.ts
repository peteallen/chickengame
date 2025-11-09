import { Container, Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

const randomRange = (min: number, max: number) => min + Math.random() * (max - min);
const pickRandom = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const BASE_HEIGHT = -130;
const SLACK_RANGE = 46;
const STRING_COLOR = 0xb5a89b;

const paletteFromTheme = (theme: Theme): number[] => [
  theme.chicken.comb,
  theme.chicken.wattle,
  theme.chicken.beakHighlight,
  theme.chick.bodyPrimary,
  theme.chick.wing,
  theme.barn.highlight,
  0xfff799,
  0xa5ddff,
  0xffb4f4,
  0xc4bcff,
];

type BalloonSprite = {
  container: Container;
  attachPoint: { x: number; y: number };
  baseOffset: { x: number; y: number };
  wobbleSpeed: number;
  wobblePhase: number;
  wobbleAmplitude: number;
};

export type BalloonBundle = {
  view: Container;
  setGrabProgress: (value: number) => void;
  setLiftOffset: (offset: { x: number; y: number }) => void;
  setReleaseProgress: (value: number) => void;
  update: (deltaMS: number) => void;
  destroy: () => void;
};

const createBalloonGraphic = (color: number): BalloonSprite => {
  const container = new Container();
  container.sortableChildren = true;

  const balloon = new Graphics();
  const width = 56 + Math.random() * 10;
  const height = 74 + Math.random() * 14;
  balloon
    .ellipse(0, 0, width / 2, height / 2)
    .fill({ color, alpha: 0.96 })
    .stroke({ color: 0xffffff, alpha: 0.22, width: 2 });

  const highlight = new Graphics();
  highlight
    .ellipse(-width * 0.18, -height * 0.08, width * 0.22, height * 0.32)
    .fill({ color: 0xffffff, alpha: 0.25 });
  highlight.rotation = -0.3;

  const knot = new Graphics();
  knot
    .moveTo(-4, height / 2 - 4)
    .lineTo(4, height / 2 - 4)
    .lineTo(0, height / 2 + 4)
    .closePath()
    .fill({ color, alpha: 0.95 })
    .stroke({ color: 0xffffff, alpha: 0.16, width: 1.2 });

  container.addChild(balloon, highlight, knot);

  return {
    container,
    attachPoint: { x: 0, y: height / 2 + 4 },
    baseOffset: { x: 0, y: 0 },
    wobbleSpeed: 0,
    wobblePhase: 0,
    wobbleAmplitude: 0,
  };
};

export const createBalloonBundle = (options: { theme: Theme; count?: number } | { theme: Theme }): BalloonBundle => {
  const { theme } = options;
  const count = 'count' in options && options.count ? options.count : 4;
  const palette = paletteFromTheme(theme);

  const view = new Container();
  view.sortableChildren = true;
  view.eventMode = 'none';

  const stringLayer = new Graphics();
  stringLayer.zIndex = 0.5;
  const balloonLayer = new Container();
  balloonLayer.zIndex = 1;

  view.addChild(stringLayer, balloonLayer);

  const balloons: BalloonSprite[] = [];

  for (let i = 0; i < count; i += 1) {
    const color = pickRandom(palette);
    const sprite = createBalloonGraphic(color);
    const spread = 32;
    sprite.baseOffset = {
      x: (i - (count - 1) / 2) * spread + randomRange(-6, 6),
      y: randomRange(-12, 6),
    };
    sprite.wobbleSpeed = 0.001 + Math.random() * 0.0008;
    sprite.wobblePhase = Math.random() * Math.PI * 2;
    sprite.wobbleAmplitude = randomRange(3, 7);
    balloonLayer.addChild(sprite.container);
    balloons.push(sprite);
  }

  let elapsedMS = 0;
  let grabProgress = 0;
  let liftOffset = { x: 0, y: 0 };
  let releaseProgress = 0;

  const updateStrings = (tension: number) => {
    stringLayer.clear();
    const alpha = clamp(1 - releaseProgress * 1.1, 0, 1);
    if (alpha <= 0) {
      return;
    }
    const sag = lerp(22, 4, tension);
    balloons.forEach((balloon) => {
      const attachX = balloonLayer.position.x + balloon.container.position.x + balloon.attachPoint.x;
      const attachY = balloonLayer.position.y + balloon.container.position.y + balloon.attachPoint.y;
      const controlX = attachX * 0.22;
      const controlY = attachY * 0.55 + sag;
      stringLayer
        .moveTo(0, 0)
        .quadraticCurveTo(controlX, controlY, attachX, attachY)
        .stroke({ color: STRING_COLOR, width: 2.2, alpha });
    });
  };

  const updateBalloons = () => {
    const tension = easeOutCubic(grabProgress);
    const heightOffset = BASE_HEIGHT - tension * SLACK_RANGE + liftOffset.y;
    balloonLayer.position.set(liftOffset.x, heightOffset);

    balloons.forEach((balloon) => {
      const wobble = Math.sin(elapsedMS * balloon.wobbleSpeed + balloon.wobblePhase) * balloon.wobbleAmplitude;
      const bob = Math.sin(elapsedMS * (balloon.wobbleSpeed * 0.6) + balloon.wobblePhase * 0.5) * 6;
      const releaseLift = releaseProgress * 30;
      balloon.container.position.set(
        balloon.baseOffset.x + wobble * (1 - releaseProgress * 0.4),
        balloon.baseOffset.y - bob - releaseLift * 0.3,
      );
      balloon.container.alpha = clamp(1 - releaseProgress * 0.05, 0, 1);
    });

    view.alpha = clamp(1 - releaseProgress * 0.02, 0, 1);
    updateStrings(tension);
  };

  const setGrabProgress = (value: number) => {
    grabProgress = clamp(value);
    updateBalloons();
  };

  const setLiftOffset = (offset: { x: number; y: number }) => {
    liftOffset = { x: offset.x, y: offset.y };
    updateBalloons();
  };

  const setReleaseProgress = (value: number) => {
    releaseProgress = clamp(value);
    updateBalloons();
  };

  const update = (deltaMS: number) => {
    elapsedMS += deltaMS;
    updateBalloons();
  };

  const destroy = () => {
    view.destroy({ children: true });
  };

  // Initialize layout
  updateBalloons();

  return {
    view,
    setGrabProgress,
    setLiftOffset,
    setReleaseProgress,
    update,
    destroy,
  };
};
