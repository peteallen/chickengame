import { Graphics, Texture, WRAP_MODES } from 'pixi.js';
import type { Theme } from '../config/theme';

export type GrassFieldLayout = {
  width: number;
  height: number;
  padding: number;
  horizonY: number;
};

export const createGrassField = (colors: Theme['grass']) => {
  const view = new Graphics();
  const texture = createGrassTexture(colors);

  view.on('destroyed', () => {
    if (!texture.destroyed) {
      texture.destroy(true);
    }
  });

  const draw = ({ width, height, padding, horizonY }: GrassFieldLayout) => {
    view.clear();

    const startX = -padding;
    const startY = -padding;
    const totalWidth = width + padding * 2;
    const totalHeight = height + padding * 2;
    const viewBottom = startY + totalHeight;

    const clampedHorizon = Math.min(
      viewBottom - 1,
      Math.max(startY, horizonY),
    );
    const groundHeight = Math.max(1, viewBottom - clampedHorizon);

    view.rect(startX, clampedHorizon, totalWidth, groundHeight).fill({
      texture,
      color: colors.base,
      alpha: 0.98,
      textureSpace: 'global',
    });

    drawGrassClusters(view, colors, {
      startX,
      width: totalWidth,
      horizonY: clampedHorizon,
      bottomY: startY + totalHeight,
      padding,
      seed: Math.floor(width * 13.37 + height * 7.91),
    });

    const depthSag = Math.max(28, padding * 0.35);
    const midX = startX + totalWidth / 2;
    view
      .moveTo(startX, clampedHorizon)
      .quadraticCurveTo(
        midX,
        clampedHorizon + depthSag,
        startX + totalWidth,
        clampedHorizon,
      )
      .lineTo(startX + totalWidth, startY + totalHeight)
      .lineTo(startX, startY + totalHeight)
      .closePath()
      .fill({ color: colors.depth, alpha: 0.45 });

    const stripeCount = Math.max(4, Math.floor(totalWidth / 70));
    for (let i = 0; i < stripeCount; i += 1) {
      const progress = i / (stripeCount - 1);
      const x = startX + progress * totalWidth;
      const stripeStartY = clampedHorizon + Math.max(16, padding * 0.3);
      view
        .moveTo(x, stripeStartY)
        .lineTo(x + padding * 0.6, startY + totalHeight)
        .stroke({ color: colors.accent, width: 2, alpha: 0.25 });
    }

    drawFlowerPatch(view, colors, {
      startX,
      width: totalWidth,
      horizonY: clampedHorizon,
      bottomY: startY + totalHeight,
      padding,
      seed: Math.floor(width * 31.75 + height * 19.3),
    });
  };

  return { view, draw } as const;
};

type RGB = { r: number; g: number; b: number };

type ClusterArea = {
  startX: number;
  width: number;
  horizonY: number;
  bottomY: number;
  padding: number;
  seed: number;
};

type GrassBladeOptions = {
  baseX: number;
  baseY: number;
  height: number;
  halfWidth: number;
  sway: number;
  color: number;
  alpha: number;
};

type FlowerStyle = {
  petal: number;
  center: number;
  ring: number;
};

const flowerPalettes: FlowerStyle[] = [
  { petal: 0xffc5de, center: 0xfff7c7, ring: 0xff9fc8 },
  { petal: 0xfff1b5, center: 0xffdd75, ring: 0xffc94d },
  { petal: 0xcfe7ff, center: 0xfff8d5, ring: 0xa7d6ff },
  { petal: 0xd8ffd2, center: 0xfff4cc, ring: 0xaadfaa },
];

const drawGrassClusters = (
  target: Graphics,
  colors: Theme['grass'],
  area: ClusterArea,
) => {
  const { startX, width, horizonY, bottomY, padding, seed } = area;
  const span = Math.max(1, bottomY - horizonY);
  const random = createSeededRandom((seed ^ padding ^ 0x9e3779b9) >>> 0);
  const clusterCount = Math.max(18, Math.floor(width / 32));
  const depthColor = hexToRgb(colors.depth);
  const accentColor = hexToRgb(colors.accent);
  const baseColor = hexToRgb(colors.base);

  for (let i = 0; i < clusterCount; i += 1) {
    const baseX = startX + random() * width;
    const distance = random() ** 1.4;
    const baseY = horizonY + span * (0.1 + distance * 0.85);
    const scale = 0.65 + random() * 1.4;
    const bladesInCluster = 2 + Math.floor(random() * 3);

    for (let bladeIndex = 0; bladeIndex < bladesInCluster; bladeIndex += 1) {
      const offset = (bladeIndex - (bladesInCluster - 1) / 2) * (4 * scale);
      const randomSway = (random() - 0.5) * 8 * scale;
      const height = (12 + random() * 14) * scale;
      const halfWidth = (0.6 + random() * 0.7) * scale;
      const accentBlend = random() * 0.08;
      const depthWeight = 0.7 + distance * 0.25;
      let colorMix = mixRgb(depthColor, baseColor, 0.05 + random() * 0.1);
      colorMix = mixRgb(colorMix, depthColor, depthWeight);
      colorMix = mixRgb(colorMix, accentColor, accentBlend);
      colorMix = adjustLightness(colorMix, -0.35 - random() * 0.2);
      const colorHex = rgbToHex(colorMix);

      drawBlade(target, {
        baseX: baseX + offset + (random() - 0.5) * 1.5,
        baseY,
        height,
        halfWidth,
        sway: randomSway,
        color: colorHex,
        alpha: 0.5 + random() * 0.35,
      });
    }
  }
};

const drawBlade = (target: Graphics, blade: GrassBladeOptions) => {
  const { baseX, baseY, height, halfWidth, sway, color, alpha } = blade;
  const tipX = baseX + sway;
  const tipY = baseY - height;

  target
    .moveTo(baseX - halfWidth, baseY)
    .quadraticCurveTo(
      baseX - halfWidth * 0.6 + sway * 0.15,
      baseY - height * 0.6,
      tipX,
      tipY,
    )
    .quadraticCurveTo(
      baseX + halfWidth * 0.6 + sway * 0.85,
      baseY - height * 0.35,
      baseX + halfWidth,
      baseY,
    )
    .closePath()
    .fill({ color, alpha });
};

const drawFlowerPatch = (
  target: Graphics,
  colors: Theme['grass'],
  area: ClusterArea,
) => {
  const { startX, width, horizonY, bottomY, padding, seed } = area;
  const span = Math.max(1, bottomY - horizonY);
  const random = createSeededRandom((seed ^ padding ^ 0x4b825dc5) >>> 0);
  const flowerCount = Math.max(12, Math.floor(width / 84));
  const depthColor = hexToRgb(colors.depth);
  const accentColor = hexToRgb(colors.accent);
  const baseStemColor = mixRgb(depthColor, accentColor, 0.2);

  for (let i = 0; i < flowerCount; i += 1) {
    const style =
      flowerPalettes[Math.floor(random() * flowerPalettes.length)] ??
      flowerPalettes[0];

    const baseX = startX + random() * width;
    const depthFactor = random() ** 1.6;
    const baseY =
      horizonY + span * (0.08 + depthFactor * 0.9) + (random() - 0.5) * 6;
    const stemHeight =
      (22 + random() * 24) * (0.85 + (1 - depthFactor) * 0.7) +
      Math.max(0, padding * 0.05);
    const sway = (random() - 0.5) * 9;
    const centerX = baseX + sway * 0.6;
    const centerY = baseY - stemHeight;
    let stemColor = mixRgb(baseStemColor, depthColor, 0.35 + random() * 0.2);
    stemColor = mixRgb(stemColor, accentColor, 0.25);
    stemColor = adjustLightness(stemColor, 0.08 + (random() - 0.5) * 0.15);
    const stemWidth = 1.2 + random() * 0.9;
    const stemHighlight = adjustLightness(stemColor, 0.25);
    const stemHex = rgbToHex(stemColor);

    target
      .moveTo(baseX, baseY)
      .quadraticCurveTo(
        baseX + sway * 0.25,
        baseY - stemHeight * 0.5,
        centerX,
        centerY + 1.5,
      )
      .stroke({
        color: stemHex,
        width: stemWidth,
        alpha: 1,
        cap: 'round',
        join: 'round',
      });

    target
      .moveTo(baseX, baseY)
      .quadraticCurveTo(
        baseX + sway * 0.18,
        baseY - stemHeight * 0.45,
        centerX,
        centerY + 1,
      )
      .stroke({
        color: rgbToHex(stemHighlight),
        width: stemWidth * 0.45,
        alpha: 0.7,
        cap: 'round',
        join: 'round',
      });

    target
      .circle(baseX, baseY + 0.9, stemWidth * 0.45)
      .fill({ color: stemHex, alpha: 0.85 });

    if (random() > 0.5) {
      const leafCount = random() > 0.75 ? 2 : 1;
      for (let l = 0; l < leafCount; l += 1) {
        const leafY =
          baseY -
          stemHeight *
            (0.25 + random() * 0.45 + (leafCount > 1 ? l * 0.15 : 0));
        const leafOffset = (random() - 0.5) * 12;
        const leafColor = mixRgb(stemColor, accentColor, 0.3 + random() * 0.25);
        target
          .ellipse(
            baseX + leafOffset * 0.5,
            leafY,
            2.6 + random() * 1.8,
            1.1 + random() * 0.8,
          )
          .fill({ color: rgbToHex(leafColor), alpha: 0.7 });
      }
    }

    const petalCount = 4 + Math.floor(random() * 4); // 4-7 petals
    const petalBase = 4.6 + random() * 3.8;
    const petalLength = petalBase * 3.8;
    const petalWidth = (1.2 + random() * 0.9) * 6;
    const petalRgb = adjustLightness(
      hexToRgb(style.petal),
      (random() - 0.5) * 0.2,
    );
    const ringRgb = adjustLightness(hexToRgb(style.ring), (random() - 0.5) * 0.15);
    const centerRgb = adjustLightness(
      hexToRgb(style.center),
      (random() - 0.5) * 0.15,
    );

    for (let petal = 0; petal < petalCount; petal += 1) {
      const angle =
        (Math.PI * 2 * petal) / petalCount + (random() - 0.5) * 0.28;
      const normalAngle = angle + Math.PI / 2;
      const tipX = centerX + Math.cos(angle) * petalLength;
      const tipY = centerY + Math.sin(angle) * petalLength * 0.92;
      const ctrlLength = petalLength * (0.45 + random() * 0.18);
      const ctrlWidth = petalWidth * (0.85 + random() * 0.35);
      const ctrl1X =
        centerX +
        Math.cos(angle) * ctrlLength +
        Math.cos(normalAngle) * ctrlWidth;
      const ctrl1Y =
        centerY +
        Math.sin(angle) * ctrlLength +
        Math.sin(normalAngle) * ctrlWidth;
      const ctrl2X =
        centerX +
        Math.cos(angle) * ctrlLength -
        Math.cos(normalAngle) * ctrlWidth;
      const ctrl2Y =
        centerY +
        Math.sin(angle) * ctrlLength -
        Math.sin(normalAngle) * ctrlWidth;

      target
        .moveTo(centerX, centerY)
        .quadraticCurveTo(ctrl1X, ctrl1Y, tipX, tipY)
        .quadraticCurveTo(ctrl2X, ctrl2Y, centerX, centerY)
        .closePath()
        .fill({ color: rgbToHex(petalRgb), alpha: 0.95 });
    }

    const ringRadius = petalLength * 0.16;
    const centerRadius = ringRadius * 0.5;
    const highlightRadius = centerRadius * 0.4;

    target
      .circle(centerX, centerY, ringRadius)
      .fill({ color: rgbToHex(ringRgb), alpha: 0.95 });
    target
      .circle(centerX, centerY, centerRadius)
      .fill({ color: rgbToHex(centerRgb), alpha: 0.98 });
    target
      .circle(centerX, centerY - highlightRadius * 0.4, highlightRadius)
      .fill({
        color: rgbToHex(adjustLightness(centerRgb, 0.25)),
        alpha: 0.9,
      });
  }
};

const createGrassTexture = (colors: Theme['grass']) => {
  const size = 64;
  const buffer = new Uint8Array(size * size * 4);
  const random = createSeededRandom(0x5eedbabe);
  const base = hexToRgb(colors.base);
  const accent = hexToRgb(colors.accent);
  const depth = hexToRgb(colors.depth);

  const coarseSize = 8;
  const coarseNoise = new Array(coarseSize * coarseSize)
    .fill(0)
    .map(() => random());
  const wrap01 = (value: number) => {
    let wrapped = value % 1;
    if (wrapped < 0) {
      wrapped += 1;
    }
    return wrapped;
  };
  const sampleCoarse = (nx: number, ny: number) => {
    const x = wrap01(nx) * coarseSize;
    const y = wrap01(ny) * coarseSize;
    const xi = Math.floor(x) % coarseSize;
    const yi = Math.floor(y) % coarseSize;
    const xf = x - xi;
    const yf = y - yi;
    const x1 = (xi + 1) % coarseSize;
    const y1 = (yi + 1) % coarseSize;

    const c00 = coarseNoise[yi * coarseSize + xi];
    const c10 = coarseNoise[yi * coarseSize + x1];
    const c01 = coarseNoise[y1 * coarseSize + xi];
    const c11 = coarseNoise[y1 * coarseSize + x1];
    const top = lerp(c00, c10, xf);
    const bottom = lerp(c01, c11, xf);
    return lerp(top, bottom, yf);
  };

  const swirlOffsetA = random() * Math.PI * 2;
  const swirlOffsetB = random() * Math.PI * 2;

  for (let y = 0; y < size; y += 1) {
    const ny = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const nx = x / (size - 1);
      const bufferIndex = (y * size + x) * 4;
      const coarse = sampleCoarse(nx * 2.3, ny * 2.1);
      const detail = sampleCoarse(nx * 3.8 + ny * 0.6, ny * 3.4 - nx * 0.4);
      const grain = sampleCoarse(nx * 6.2 + 0.13, ny * 6.2 + 0.37);
      const fiber = Math.sin(
        (nx * Math.PI * 6 + swirlOffsetA) + detail * 3,
      ) * Math.cos((ny * Math.PI * 4 + swirlOffsetB) + coarse * 2);

      const depthWeight = 0.18 + ny * 0.25 + coarse * 0.18;
      const accentWeight = 0.18 + detail * 0.15;
      let color = mixRgb(base, depth, depthWeight);
      color = mixRgb(color, accent, accentWeight);
      color = adjustLightness(
        color,
        (coarse - 0.5) * 0.16 + (grain - 0.5) * 0.08,
      );

      if (fiber > 0.6) {
        color = mixRgb(color, accent, 0.2);
      } else if (fiber < -0.55) {
        color = mixRgb(color, depth, 0.18);
      }

      if (grain > 0.82) {
        color = adjustLightness(color, 0.12);
      } else if (grain < 0.18) {
        color = adjustLightness(color, -0.08);
      }

      color = mixRgb(color, base, 0.35);

      buffer[bufferIndex] = color.r;
      buffer[bufferIndex + 1] = color.g;
      buffer[bufferIndex + 2] = color.b;
      buffer[bufferIndex + 3] = 255;
    }
  }

  const generatedTexture = Texture.from({
    resource: buffer,
    width: size,
    height: size,
    format: 'rgba8unorm',
  });
  generatedTexture.source.wrapMode = WRAP_MODES.REPEAT;

  return generatedTexture;
};

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

const hexToRgb = (hex: number): RGB => ({
  r: (hex >> 16) & 0xff,
  g: (hex >> 8) & 0xff,
  b: hex & 0xff,
});

const rgbToHex = (color: RGB): number =>
  (color.r << 16) | (color.g << 8) | color.b;

const mixRgb = (a: RGB, b: RGB, t: number): RGB => ({
  r: clampChannel(lerp(a.r, b.r, t)),
  g: clampChannel(lerp(a.g, b.g, t)),
  b: clampChannel(lerp(a.b, b.b, t)),
});

const adjustLightness = (color: RGB, delta: number): RGB => ({
  r: clampChannel(color.r + color.r * delta),
  g: clampChannel(color.g + color.g * delta),
  b: clampChannel(color.b + color.b * delta),
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const clampChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)));
