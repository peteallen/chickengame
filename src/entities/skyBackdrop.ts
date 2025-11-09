import { Container, Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';

export type SkyBackdropLayout = {
  width: number;
  height: number;
  horizonY: number;
};

export type SkyBackdrop = {
  view: Container;
  layout: (layout: SkyBackdropLayout) => void;
  update: (deltaMS: number) => void;
  setMode: (mode: SkyBackdropMode) => void;
  getMode: () => SkyBackdropMode;
};

export type SkyBackdropMode = 'day' | 'night';

type LayerConfig = {
  depthRange: [number, number];
  speedRange: [number, number];
  scaleRange: [number, number];
  alpha: number;
};

type CloudInstance = {
  view: Container;
  halfWidth: number;
  yRange: [number, number];
  speed: number;
};

type StarInstance = {
  sprite: Graphics;
  phase: number;
  speed: number;
  amplitude: number;
  baseAlpha: number;
};

type NightGradient = {
  top: number;
  mid: number;
  horizon: number;
};

const nightGradient: NightGradient = {
  top: 0x020712,
  mid: 0x08132b,
  horizon: 0x13264a,
};

const layerConfigs: LayerConfig[] = [
  {
    depthRange: [0.08, 0.32],
    speedRange: [5, 11],
    scaleRange: [0.7, 0.95],
    alpha: 0.7,
  },
  {
    depthRange: [0.18, 0.48],
    speedRange: [10, 17],
    scaleRange: [0.85, 1.15],
    alpha: 0.85,
  },
  {
    depthRange: [0.3, 0.64],
    speedRange: [16, 26],
    scaleRange: [1.05, 1.35],
    alpha: 0.95,
  },
];

export const createSkyBackdrop = (
  colors: Theme['atmosphere'],
): SkyBackdrop => {
  const view = new Container();
  view.eventMode = 'none';

  const background = new Graphics();
  background.eventMode = 'none';

  const sunContainer = new Container();
  sunContainer.eventMode = 'none';
  const sunHalo = new Graphics();
  const sunGlow = new Graphics();
  const sunCore = new Graphics();
  sunContainer.addChild(sunHalo, sunGlow, sunCore);

  const starsLayer = new Container();
  starsLayer.eventMode = 'none';
  starsLayer.visible = false;

  const layerContainers = layerConfigs.map(() => {
    const layerView = new Container();
    layerView.eventMode = 'none';
    return layerView;
  });
  const [farLayer, midLayer, nearLayer] = layerContainers;

  view.addChild(background, starsLayer, farLayer, sunContainer, midLayer, nearLayer);

  const clouds: CloudInstance[] = [];
  const stars: StarInstance[] = [];
  let layoutWidth = 0;
  let layoutHorizon = 0;
  let layoutInfo: SkyBackdropLayout | null = null;
  let mode: SkyBackdropMode = 'day';

  const clearLayerChildren = (layer: Container) => {
    const removed = layer.removeChildren();
    removed.forEach((child) => child.destroy({ children: true }));
  };

  const clearClouds = () => {
    layerContainers.forEach((layer) => clearLayerChildren(layer));
    clouds.length = 0;
  };

  const clearStars = () => {
    clearLayerChildren(starsLayer);
    stars.length = 0;
  };

  const regenerateStars = (info: SkyBackdropLayout) => {
    clearStars();
    const { width, horizonY } = info;
    const seed = ((width * 211) ^ (horizonY * 131)) >>> 0;
    const random = createSeededRandom(seed);
    const starCount = Math.max(50, Math.round(width / 10));
    const skyHeight = Math.max(40, horizonY * 0.95);
    for (let i = 0; i < starCount; i += 1) {
      const radius = 0.6 + random() * 1.4;
      const sprite = new Graphics();
      sprite.circle(0, 0, radius).fill({ color: 0xffffff, alpha: 1 });
      sprite.position.set(random() * width, random() * skyHeight * 0.95);
      const baseAlpha = 0.35 + random() * 0.55;
      sprite.alpha = baseAlpha;
      starsLayer.addChild(sprite);
      stars.push({
        sprite,
        phase: random() * Math.PI * 2,
        speed: 2 + random() * 3,
        amplitude: 0.4 + random() * 0.4,
        baseAlpha,
      });
    }
  };

  const refreshBackdrop = () => {
    if (!layoutInfo) {
      return;
    }
    drawBackground(layoutInfo, mode, background, colors);
    if (mode === 'day') {
      drawSun(layoutInfo, { sunHalo, sunGlow, sunCore }, colors);
      starsLayer.visible = false;
      clearStars();
      regenerateClouds(layoutInfo, {
        colors,
        layerContainers,
        clouds,
      });
    } else {
      drawMoon(layoutInfo, { sunHalo, sunGlow, sunCore });
      clearClouds();
      starsLayer.visible = true;
      regenerateStars(layoutInfo);
    }
  };

  const layout = ({ width, height, horizonY }: SkyBackdropLayout) => {
    layoutWidth = width;
    layoutHorizon = horizonY;
    layoutInfo = { width, height, horizonY };
    refreshBackdrop();
  };

  const update = (deltaMS: number) => {
    if (!layoutWidth) {
      return;
    }

    const deltaSeconds = deltaMS / 1000;
    const wrapMargin = Math.max(80, layoutWidth * 0.12);

    for (const cloud of clouds) {
      cloud.view.x += cloud.speed * deltaSeconds;
      const leftEdge = cloud.view.x - cloud.halfWidth;
      if (leftEdge > layoutWidth + wrapMargin) {
        cloud.view.x = -wrapMargin - cloud.halfWidth;
        cloud.view.y = sampleLayerY(cloud.yRange, layoutHorizon, Math.random);
      }
    }

    if (mode === 'night') {
      for (const star of stars) {
        star.phase += deltaSeconds * star.speed;
        const twinkle = 0.7 + Math.sin(star.phase) * star.amplitude;
        star.sprite.alpha = Math.min(1, Math.max(0, star.baseAlpha * twinkle));
      }
    }
  };

  const setMode = (next: SkyBackdropMode) => {
    if (mode === next) {
      return;
    }
    mode = next;
    refreshBackdrop();
  };

  const getMode = () => mode;

  const regenerateClouds = (
    layoutInfo: SkyBackdropLayout,
    context: {
      colors: Theme['atmosphere'];
      layerContainers: Container[];
      clouds: CloudInstance[];
    },
  ) => {
    clearClouds();

    const { colors: palette, layerContainers: containers, clouds: cloudList } = context;
    const { width, horizonY } = layoutInfo;
    const seed = ((width * 97) ^ (horizonY * 53)) >>> 0;
    const seededRandom = createSeededRandom(seed);
    const baseCount = Math.max(2, Math.round(width / 280));

    layerConfigs.forEach((config, index) => {
      const layer = containers[index];
      const rawCount =
        baseCount + index + Math.round(seededRandom() * (1 + index));
      const count = Math.max(1, Math.round(rawCount * 0.5));
      for (let i = 0; i < count; i += 1) {
        const scale = lerp(
          config.scaleRange[0],
          config.scaleRange[1],
          seededRandom(),
        );
        const puff = 0.6 + seededRandom() * 0.4;
        const cloudDrawable = createCloud({
          colors: palette,
          scale,
          puff,
          random: seededRandom,
        });
        cloudDrawable.view.alpha = config.alpha;
        cloudDrawable.view.x =
          -width * 0.15 + seededRandom() * (width * 1.3);
        cloudDrawable.view.y = sampleLayerY(
          config.depthRange,
          horizonY,
          seededRandom,
        );
        layer.addChild(cloudDrawable.view);
        cloudList.push({
          view: cloudDrawable.view,
          halfWidth: cloudDrawable.halfWidth,
          yRange: config.depthRange,
          speed: lerp(
            config.speedRange[0],
            config.speedRange[1],
            seededRandom(),
          ),
        });
      }
    });
  };

  return { view, layout, update, setMode, getMode };
};

const drawSun = (
  { width, horizonY }: SkyBackdropLayout,
  parts: { sunHalo: Graphics; sunGlow: Graphics; sunCore: Graphics },
  colors: Theme['atmosphere'],
) => {
  const radius = Math.max(36, Math.min(96, Math.min(width, horizonY) * 0.18));
  const centerX = width - radius * 1.25;
  const centerY = Math.max(radius * 0.85, horizonY * 0.12);

  parts.sunHalo.position.set(centerX, centerY);
  parts.sunGlow.position.set(centerX, centerY);
  parts.sunCore.position.set(centerX, centerY);

  parts.sunHalo
    .clear()
    .circle(0, 0, radius * 1.9)
    .fill({ color: colors.sunHalo, alpha: 0.35 })
    .circle(0, 0, radius * 1.45)
    .fill({ color: colors.sunGlow, alpha: 0.25 });

  parts.sunGlow
    .clear()
    .circle(0, 0, radius * 1.1)
    .fill({ color: colors.sunGlow, alpha: 0.65 });

  parts.sunCore
    .clear()
    .circle(0, 0, radius)
    .fill({ color: colors.sunCore, alpha: 1 })
    .circle(0, -radius * 0.25, radius * 0.4)
    .fill({ color: 0xffffff, alpha: 0.45 });
};

const drawMoon = (
  { width, horizonY }: SkyBackdropLayout,
  parts: { sunHalo: Graphics; sunGlow: Graphics; sunCore: Graphics },
) => {
  const radius = Math.max(32, Math.min(86, Math.min(width, horizonY) * 0.16));
  const centerX = width - radius * 1.2;
  const centerY = Math.max(radius * 0.75, horizonY * 0.2);

  parts.sunHalo.position.set(centerX, centerY);
  parts.sunGlow.position.set(centerX, centerY);
  parts.sunCore.position.set(centerX, centerY);

  parts.sunHalo
    .clear()
    .circle(0, 0, radius * 2)
    .fill({ color: 0xffffff, alpha: 0.08 })
    .circle(0, 0, radius * 1.4)
    .fill({ color: 0xbfcfff, alpha: 0.12 });

  parts.sunGlow
    .clear()
    .circle(0, 0, radius * 1.15)
    .fill({ color: 0xe5ecff, alpha: 0.28 });

  parts.sunCore
    .clear()
    .circle(0, 0, radius)
    .fill({ color: 0xfafcff, alpha: 1 })
    .circle(radius * 0.38, -radius * 0.1, radius * 0.78)
    .fill({ color: nightGradient.top, alpha: 0.95 })
    .circle(-radius * 0.28, -radius * 0.18, radius * 0.12)
    .fill({ color: 0xd8e3ff, alpha: 0.55 })
    .circle(-radius * 0.12, radius * 0.05, radius * 0.08)
    .fill({ color: 0xd3dfff, alpha: 0.45 });
};

const drawBackground = (
  layout: SkyBackdropLayout,
  mode: SkyBackdropMode,
  background: Graphics,
  colors: Theme['atmosphere'],
) => {
  const { width, height, horizonY } = layout;
  background.clear();
  if (mode === 'day') {
    background
      .rect(0, 0, width, height)
      .fill({ color: 0x63b9ff, alpha: 1 })
      .rect(0, 0, width, horizonY * 0.8)
      .fill({ color: colors.sunGlow, alpha: 0.18 })
      .rect(0, horizonY * 0.55, width, horizonY * 0.6)
      .fill({ color: colors.sunHalo, alpha: 0.12 });
    return;
  }

  background
    .rect(0, 0, width, height)
    .fill({ color: nightGradient.top, alpha: 1 })
    .rect(0, horizonY * 0.15, width, horizonY * 0.55)
    .fill({ color: nightGradient.mid, alpha: 0.85 })
    .rect(0, horizonY * 0.55, width, height - horizonY * 0.55)
    .fill({ color: nightGradient.horizon, alpha: 0.9 });
};

const createCloud = ({
  colors,
  scale,
  puff,
  random,
}: {
  colors: Theme['atmosphere'];
  scale: number;
  puff: number;
  random: () => number;
}) => {
  const view = new Container();
  view.eventMode = 'none';
  const shadow = new Graphics();
  const body = new Graphics();
  const highlight = new Graphics();
  const mist = new Graphics();
  view.addChild(shadow, body, highlight, mist);

  const baseWidth = 140 * scale;
  const lumpCount = 4 + Math.floor(random() * 3);
  type Lump = { x: number; y: number; rx: number; ry: number };
  const lumps: Lump[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < lumpCount; i += 1) {
    const t = lumpCount === 1 ? 0.5 : i / (lumpCount - 1);
    const x =
      (t - 0.5) * baseWidth * (0.9 + random() * 0.25) +
      (random() - 0.5) * baseWidth * 0.15;
    const rx = baseWidth * (0.17 + random() * 0.22) * (0.9 + puff * 0.35);
    const ry = rx * (0.55 + random() * 0.25);
    const y =
      Math.sin(t * Math.PI) * -rx * 0.3 +
      (random() - 0.5) * rx * 0.35 -
      ry * 0.1;
    lumps.push({ x, y, rx, ry });
    minX = Math.min(minX, x - rx);
    maxX = Math.max(maxX, x + rx);
    minY = Math.min(minY, y - ry);
    maxY = Math.max(maxY, y + ry);
  }

  const width = Math.max(40, maxX - minX);
  const height = Math.max(20, maxY - minY);
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  const shadeOffsetX = width * 0.04;
  const shadeOffsetY = height * 0.12;

  lumps.forEach((lump, index) => {
    const depth = index / Math.max(1, lumps.length - 1);
    const lx = lump.x - centerX;
    const ly = lump.y - centerY;
    shadow
      .ellipse(
        lx + shadeOffsetX * (0.5 + depth * 0.7),
        ly + shadeOffsetY * (0.9 - depth * 0.2),
        lump.rx * 1.1,
        lump.ry * 1.05,
      )
      .fill({ color: colors.cloudShadow, alpha: 0.55 });

    body
      .ellipse(lx, ly, lump.rx, lump.ry)
      .fill({ color: colors.cloudLight, alpha: 0.97 });

    if (depth < 0.65) {
      body
        .ellipse(lx + shadeOffsetX * 0.2, ly - lump.ry * 0.18, lump.rx * 0.78, lump.ry * 0.72)
        .fill({ color: colors.cloudMid, alpha: 0.55 });
    }
  });

  highlight
    .ellipse(0, -height * 0.15, width * 0.35, height * 0.28)
    .fill({ color: colors.cloudHighlight, alpha: 0.4 })
    .ellipse(0, -height * 0.05, width * 0.5, height * 0.18)
    .fill({ color: colors.cloudMid, alpha: 0.22 });

  mist
    .roundRect(-width * 0.42, height * 0.05, width * 0.84, height * 0.28, height * 0.12)
    .fill({ color: colors.cloudShadow, alpha: 0.18 });

  return { view, halfWidth: width / 2 };
};

const sampleLayerY = (
  depthRange: [number, number],
  horizonY: number,
  rand: () => number,
) => {
  const t = depthRange[0] + (depthRange[1] - depthRange[0]) * rand();
  return horizonY * Math.min(0.98, Math.max(0.02, t));
};

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
