import { Container, Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';

export type BarnLayout = {
  centerX: number;
  baseY: number;
  width: number;
  horizonY: number;
};

export const createBarn = (colors: Theme['barn']) => {
  const view = new Container();
  const groundShadow = new Graphics();
  const body = new Graphics();
  const plankLines = new Graphics();
  const roof = new Graphics();
  const roofHighlight = new Graphics();
  const windowLayer = new Graphics();
  const doorLayer = new Graphics();
  const doorDetailLayer = new Graphics();

  view.addChild(
    groundShadow,
    body,
    plankLines,
    roof,
    roofHighlight,
    windowLayer,
    doorLayer,
    doorDetailLayer,
  );

  const draw = ({ centerX, baseY, width, horizonY }: BarnLayout) => {
    const barnWidth = Math.max(32, width);
    const bodyHeight = barnWidth * 0.68;
    const roofHeight = barnWidth * 0.35;
    const roofOverhang = Math.max(12, barnWidth * 0.08);
    const doorWidth = barnWidth * 0.32;
    const doorHeight = bodyHeight * 0.5;

    view.position.set(centerX, baseY);
    const distanceDepth = Math.min(0.45, Math.max(0, (baseY - horizonY) / 520));

    groundShadow.clear();
    const shadowWidth = barnWidth * 0.9;
    const shadowDepth = Math.max(4, barnWidth * 0.09);
    groundShadow
      .moveTo(-shadowWidth * 0.6, 3)
      .lineTo(shadowWidth * 0.55, 3)
      .lineTo(shadowWidth * 0.72, shadowDepth)
      .lineTo(-shadowWidth * 0.75, shadowDepth * 1.2)
      .closePath()
      .fill({ color: colors.shadow, alpha: 0.32 });

    body.clear();
    body
      .roundRect(
        -barnWidth / 2,
        -bodyHeight,
        barnWidth,
        bodyHeight,
        Math.max(6, barnWidth * 0.05),
      )
      .fill({ color: colors.siding });

    const plankAlpha = Math.max(0.18, 0.4 - distanceDepth * 0.25);

    plankLines.clear();
    const plankCount = 7;
    for (let i = 1; i < plankCount; i += 1) {
      const t = i / plankCount;
      const x = -barnWidth / 2 + t * barnWidth;
      plankLines
        .moveTo(x, -bodyHeight + 8)
        .lineTo(x, -6)
        .stroke({ color: colors.accent, width: 1.5, alpha: plankAlpha });
    }

    roof.clear();
    const roofBottomY = -bodyHeight + 2;
    const roofTopY = roofBottomY - roofHeight;
    const roofTopHalfWidth = Math.max(18, barnWidth * 0.28);
    roof
      .moveTo(-barnWidth / 2 - roofOverhang, roofBottomY)
      .lineTo(barnWidth / 2 + roofOverhang, roofBottomY)
      .lineTo(roofTopHalfWidth, roofTopY)
      .lineTo(-roofTopHalfWidth, roofTopY)
      .closePath()
      .fill({ color: colors.roof });

    roofHighlight.clear();
    roofHighlight
      .moveTo(-barnWidth / 2 - roofOverhang, roofBottomY + 1)
      .lineTo(barnWidth / 2 + roofOverhang, roofBottomY + 1)
      .stroke({ color: colors.trim, width: 3, alpha: 0.85, cap: 'round' });
    roofHighlight
      .moveTo(-roofTopHalfWidth + 2, roofTopY + 1)
      .lineTo(roofTopHalfWidth - 2, roofTopY + 1)
      .stroke({ color: colors.roofShadow, width: 4, alpha: 0.55, cap: 'round' });

    windowLayer.clear();
    const trimThickness = Math.max(2, barnWidth * 0.012);
    const drawTrimmedWindow = (
      cx: number,
      cy: number,
      width: number,
      height: number,
    ) => {
      const radius = Math.min(width, height) * 0.23;
      const innerInset = trimThickness * 1.1;
      const innerRadius = Math.max(2, radius - trimThickness * 0.6);
      windowLayer
        .roundRect(cx - width / 2, cy - height / 2, width, height, radius)
        .fill({ color: colors.trim });
      windowLayer
        .roundRect(
          cx - width / 2 + innerInset,
          cy - height / 2 + innerInset,
          Math.max(width - innerInset * 2, trimThickness),
          Math.max(height - innerInset * 2, trimThickness),
          innerRadius,
        )
        .fill({ color: colors.window });
      windowLayer
        .moveTo(cx, cy - height / 2 + innerInset)
        .lineTo(cx, cy + height / 2 - innerInset)
        .stroke({ color: colors.trim, width: trimThickness * 0.85 });
      windowLayer
        .moveTo(cx - width / 2 + innerInset, cy)
        .lineTo(cx + width / 2 - innerInset, cy)
        .stroke({ color: colors.trim, width: trimThickness * 0.85 });
    };

    const lowerWindowWidth = doorWidth * 0.55;
    const lowerWindowHeight = doorHeight * 0.48;
    const lowerWindowOffsetX = doorWidth * 0.85;
    const lowerWindowCenterY = -doorHeight * 0.45;
    drawTrimmedWindow(-lowerWindowOffsetX, lowerWindowCenterY, lowerWindowWidth, lowerWindowHeight);
    drawTrimmedWindow(lowerWindowOffsetX, lowerWindowCenterY, lowerWindowWidth, lowerWindowHeight);

    const upperWindowWidth = barnWidth * 0.16;
    const upperWindowHeight = bodyHeight * 0.22;
    const upperWindowCenterY = -bodyHeight + upperWindowHeight * 0.5 + barnWidth * 0.05;
    const upperGap = upperWindowWidth + barnWidth * 0.06;
    drawTrimmedWindow(-upperGap, upperWindowCenterY, upperWindowWidth, upperWindowHeight);
    drawTrimmedWindow(0, upperWindowCenterY, upperWindowWidth, upperWindowHeight);
    drawTrimmedWindow(upperGap, upperWindowCenterY, upperWindowWidth, upperWindowHeight);

    doorLayer.clear();
    doorLayer
      .roundRect(-doorWidth / 2, -doorHeight, doorWidth, doorHeight, doorWidth * 0.1)
      .fill({ color: colors.door });
    doorLayer
      .roundRect(-doorWidth / 2, -doorHeight, doorWidth, doorHeight, doorWidth * 0.1)
      .stroke({ color: colors.trim, width: 3 });

    doorDetailLayer.clear();
    doorDetailLayer
      .moveTo(-doorWidth / 2, -doorHeight)
      .lineTo(doorWidth / 2, 0)
      .stroke({ color: colors.trim, width: 2.4 });
    doorDetailLayer
      .moveTo(doorWidth / 2, -doorHeight)
      .lineTo(-doorWidth / 2, 0)
      .stroke({ color: colors.trim, width: 2.4 });
  };

  return { view, draw } as const;
};
