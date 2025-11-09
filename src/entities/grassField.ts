import { Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';

export type GrassFieldLayout = {
  width: number;
  height: number;
  padding: number;
  horizonY: number;
};

export const createGrassField = (colors: Theme['grass']) => {
  const view = new Graphics();

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
      color: colors.base,
    });

    const depthBendY = clampedHorizon + Math.max(28, padding * 0.35);
    view
      .moveTo(startX, clampedHorizon)
      .lineTo(startX + totalWidth, depthBendY)
      .lineTo(startX + totalWidth, startY + totalHeight)
      .lineTo(startX, startY + totalHeight)
      .closePath()
      .fill({ color: colors.depth, alpha: 0.6 });

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
  };

  return { view, draw } as const;
};
