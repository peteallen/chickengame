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
  const bodyShading = new Graphics();
  const plankLines = new Graphics();
  const roof = new Graphics();
  const roofHighlight = new Graphics();
  const doorLayer = new Graphics();
  const windowLayer = new Graphics();
  const playfulDetails = new Graphics();

  view.addChild(
    groundShadow,
    body,
    bodyShading,
    plankLines,
    roof,
    roofHighlight,
    doorLayer,
    windowLayer,
    playfulDetails,
  );

  const draw = ({ centerX, baseY, width, horizonY }: BarnLayout) => {
    const barnWidth = Math.max(32, width);
    const bodyHeight = barnWidth * 0.68;
    const roofHeight = barnWidth * 0.5;
    const roofOverhang = Math.max(12, barnWidth * 0.08);
    const doorWidth = barnWidth * 0.32;
    const doorHeight = bodyHeight * 0.5;
    const loftRadius = barnWidth * 0.11;
    const loftY = -bodyHeight + loftRadius * 2;

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

    bodyShading.clear();
    const highlightAlphaStrong = Math.max(0.2, 0.45 - distanceDepth * 0.3);
    const highlightAlphaSoft = Math.max(0.12, 0.3 - distanceDepth * 0.2);
    const plankAlpha = Math.max(0.18, 0.4 - distanceDepth * 0.25);
    const pennantAlpha = Math.max(0.55, 0.85 - distanceDepth * 0.2);

    bodyShading
      .roundRect(
        -barnWidth / 2 + barnWidth * 0.08,
        -bodyHeight * 0.85,
        barnWidth * 0.38,
        bodyHeight * 0.55,
        barnWidth * 0.04,
      )
      .fill({ color: colors.highlight, alpha: highlightAlphaStrong });
    bodyShading
      .roundRect(
        -barnWidth / 2 + barnWidth * 0.12,
        -bodyHeight * 0.35,
        barnWidth * 0.3,
        bodyHeight * 0.25,
        barnWidth * 0.04,
      )
      .fill({ color: colors.highlight, alpha: highlightAlphaSoft });

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
    const roofPeak = { x: 0, y: -bodyHeight - roofHeight };
    roof
      .moveTo(-barnWidth / 2 - roofOverhang, -bodyHeight + 2)
      .lineTo(roofPeak.x, roofPeak.y)
      .lineTo(barnWidth / 2 + roofOverhang, -bodyHeight + 2)
      .closePath()
      .fill({ color: colors.roof });

    roofHighlight.clear();
    roofHighlight
      .moveTo(-barnWidth / 2 - roofOverhang + 4, -bodyHeight + 1)
      .lineTo(roofPeak.x, roofPeak.y - 2)
      .lineTo(barnWidth / 2 + roofOverhang - 4, -bodyHeight + 1)
      .stroke({ color: colors.roofShadow, width: 4, alpha: 0.55, join: 'round' });
    roofHighlight
      .moveTo(-barnWidth / 2 - roofOverhang, -bodyHeight + 2)
      .lineTo(barnWidth / 2 + roofOverhang, -bodyHeight + 2)
      .stroke({ color: colors.trim, width: 3, alpha: 0.85, cap: 'round' });

    windowLayer.clear();
    windowLayer.circle(0, loftY, loftRadius).fill({ color: colors.trim });
    windowLayer.circle(0, loftY, loftRadius * 0.7).fill({ color: colors.window });
    windowLayer
      .moveTo(0, loftY - loftRadius * 0.7)
      .lineTo(0, loftY + loftRadius * 0.7)
      .stroke({ color: colors.trim, width: 1.5 });
    windowLayer
      .moveTo(-loftRadius * 0.7, loftY)
      .lineTo(loftRadius * 0.7, loftY)
      .stroke({ color: colors.trim, width: 1.5 });

    doorLayer.clear();
    doorLayer
      .roundRect(-doorWidth / 2, -doorHeight, doorWidth, doorHeight, doorWidth * 0.1)
      .fill({ color: colors.door });
    doorLayer
      .roundRect(-doorWidth / 2, -doorHeight, doorWidth, doorHeight, doorWidth * 0.1)
      .stroke({ color: colors.trim, width: 3 });
    doorLayer
      .moveTo(0, -doorHeight)
      .lineTo(0, 0)
      .stroke({ color: colors.trim, width: 2 });
    doorLayer
      .circle(-doorWidth * 0.2, -doorHeight * 0.45, doorWidth * 0.04)
      .fill({ color: colors.trim, alpha: 0.9 });
    doorLayer
      .circle(doorWidth * 0.2, -doorHeight * 0.45, doorWidth * 0.04)
      .fill({ color: colors.trim, alpha: 0.9 });

    playfulDetails.clear();
    const buntingWidth = barnWidth * 0.65;
    const buntingY = -bodyHeight * 0.58;
    const buntingStartX = -buntingWidth / 2;
    const pennantCount = 5;
    playfulDetails
      .moveTo(buntingStartX, buntingY)
      .quadraticCurveTo(0, buntingY + barnWidth * 0.06, buntingStartX + buntingWidth, buntingY)
      .stroke({ color: colors.trim, width: 1.8, alpha: 0.7 });
    for (let i = 0; i < pennantCount; i += 1) {
      const t = i / (pennantCount - 1);
      const x = buntingStartX + buntingWidth * t;
      const drop = Math.sin(Math.PI * t) * barnWidth * 0.05;
      playfulDetails
        .moveTo(x - barnWidth * 0.02, buntingY - 1)
        .lineTo(x, buntingY + drop)
        .lineTo(x + barnWidth * 0.02, buntingY - 1)
        .closePath()
        .fill({ color: t % 2 === 0 ? colors.highlight : colors.accent, alpha: pennantAlpha });
    }
  };

  return { view, draw } as const;
};
