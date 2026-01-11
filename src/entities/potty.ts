import { Container, Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const POTTY_METRICS = {
  width: 70,
  height: 90,
  seatHeight: 55,
  shadow: { width: 80, height: 24, offsetY: 42 },
} as const;

const POTTY_COLORS = {
  handle: 0xc0c0c0,
  handleOutline: 0x8b95a8,
  water: 0x87ceeb,
  hole: 0x2f415a,
} as const;

export type Potty = {
  view: Container;
  setContents: (contents: 'clean' | 'used') => void;
  setFlushProgress: (progress: number) => void;
  setSeatGlow: (active: boolean) => void;
  setHandlePress: (progress: number) => void;
  update: (deltaMS: number) => void;
  destroy: () => void;
};

export const createPotty = (theme: Theme): Potty => {
  const view = new Container();
  view.sortableChildren = true;
  view.eventMode = 'none';

  const porcelain = theme.fence.post;
  const porcelainShadow = theme.fence.shadow;
  const porcelainOutline = 0xb8c4e6;
  const seatColor = theme.atmosphere.cloudHighlight;
  const lidColor = 0xfafaf5;

  const groundY = POTTY_METRICS.shadow.offsetY;
  const seatCenterY = -POTTY_METRICS.height / 2 + 20;

  // Shadow
  const shadow = new Graphics();
  shadow
    .ellipse(0, 0, POTTY_METRICS.shadow.width / 2, POTTY_METRICS.shadow.height / 2)
    .fill({ color: theme.chicken.shadow, alpha: 0.22 });
  shadow.position.y = POTTY_METRICS.shadow.offsetY;
  shadow.zIndex = 0;
  view.addChild(shadow);

  // Tank (behind bowl)
  const tank = new Graphics();
  const tankWidth = 56;
  const tankHeight = 34;
  tank
    .roundRect(-tankWidth / 2, -tankHeight, tankWidth, tankHeight, 10)
    .fill({ color: porcelain, alpha: 0.98 })
    .stroke({ color: porcelainOutline, width: 2.5, alpha: 0.35 });
  tank.position.y = seatCenterY - 4;
  tank.zIndex = 0.5;
  view.addChild(tank);

  const tankLid = new Graphics();
  const tankLidHeight = 10;
  tankLid
    .roundRect(-tankWidth / 2 - 2, -tankHeight - tankLidHeight + 2, tankWidth + 4, tankLidHeight, 10)
    .fill({ color: lidColor, alpha: 0.98 })
    .stroke({ color: porcelainOutline, width: 2, alpha: 0.25 });
  tankLid.position.copyFrom(tank.position);
  tankLid.zIndex = 0.55;
  view.addChild(tankLid);

  // Flush handle (attached to tank)
  const handleAnchor = new Container();
  handleAnchor.position.set(tankWidth / 2 - 5, tank.position.y - tankHeight + 14);
  handleAnchor.zIndex = 0.7;
  view.addChild(handleAnchor);

  const handle = new Graphics();
  handle
    .moveTo(0, 0)
    .lineTo(14, 0)
    .stroke({ color: POTTY_COLORS.handle, width: 4, cap: 'round' });
  handle
    .moveTo(0, 0)
    .lineTo(14, 0)
    .stroke({ color: POTTY_COLORS.handleOutline, width: 1.5, cap: 'round', alpha: 0.4 });
  handle.circle(14, 0, 3.5).fill({ color: POTTY_COLORS.handle, alpha: 0.95 });
  handle.circle(14, 0, 3.5).stroke({ color: POTTY_COLORS.handleOutline, width: 1.2, alpha: 0.45 });
  handleAnchor.addChild(handle);

  // Pedestal base (helps silhouette read as a toilet)
  const base = new Graphics();
  const baseWidth = 46;
  const baseHeight = 34;
  const baseTopY = groundY - baseHeight;
  base
    .roundRect(-baseWidth / 2, baseTopY, baseWidth, baseHeight, 14)
    .fill({ color: porcelain, alpha: 0.98 });
  base
    .ellipse(0, groundY - 3, baseWidth * 0.7, 8)
    .fill({ color: porcelain, alpha: 0.98 })
    .stroke({ color: porcelainOutline, width: 2.5, alpha: 0.35 });
  base
    .moveTo(-baseWidth / 2 + 6, baseTopY + 8)
    .lineTo(-baseWidth / 2 + 6, groundY - 10)
    .stroke({ color: porcelainShadow, width: 4, alpha: 0.25, cap: 'round' });
  base.zIndex = 0.9;
  view.addChild(base);

  // Bowl (main body)
  const bowl = new Graphics();
  const bowlTopY = seatCenterY - 8;
  const bowlMidY = seatCenterY + 18;
  const bowlBottomY = groundY - 2;
  const bowlTopHalfWidth = POTTY_METRICS.width / 2 + 5;
  const bowlMidHalfWidth = POTTY_METRICS.width / 2 + 1;
  const bowlBottomHalfWidth = POTTY_METRICS.width / 2 - 14;
  bowl
    .moveTo(-bowlTopHalfWidth, bowlTopY)
    .quadraticCurveTo(-bowlTopHalfWidth - 10, (bowlTopY + bowlMidY) / 2, -bowlMidHalfWidth, bowlMidY)
    .quadraticCurveTo(-bowlMidHalfWidth + 4, bowlBottomY - 12, -bowlBottomHalfWidth, bowlBottomY)
    .lineTo(bowlBottomHalfWidth, bowlBottomY)
    .quadraticCurveTo(bowlMidHalfWidth - 4, bowlBottomY - 12, bowlMidHalfWidth, bowlMidY)
    .quadraticCurveTo(bowlTopHalfWidth + 10, (bowlTopY + bowlMidY) / 2, bowlTopHalfWidth, bowlTopY)
    .closePath()
    .fill({ color: porcelain, alpha: 0.98 })
    .stroke({ color: porcelainOutline, width: 3, alpha: 0.35 });
  bowl.zIndex = 1;
  view.addChild(bowl);

  const bowlShade = new Graphics();
  bowlShade
    .ellipse(8, bowlMidY + 8, POTTY_METRICS.width * 0.26, POTTY_METRICS.height * 0.22)
    .fill({ color: porcelainShadow, alpha: 0.22 });
  bowlShade.zIndex = 1.05;
  view.addChild(bowlShade);

  const bowlHighlight = new Graphics();
  bowlHighlight
    .ellipse(-12, bowlTopY + 20, POTTY_METRICS.width * 0.14, POTTY_METRICS.height * 0.22)
    .fill({ color: 0xffffff, alpha: 0.35 });
  bowlHighlight.zIndex = 1.1;
  view.addChild(bowlHighlight);

  // Seat + bowl opening group (keeps everything aligned so it reads instantly as a toilet)
  const seatGroup = new Container();
  seatGroup.position.y = seatCenterY;
  seatGroup.zIndex = 2;
  view.addChild(seatGroup);

  // Seat (oval ring)
  const seat = new Graphics();
  seat
    .ellipse(0, 0, POTTY_METRICS.width / 2 + 4, 16)
    .fill({ color: seatColor, alpha: 0.96 })
    .stroke({ color: porcelainOutline, width: 2, alpha: 0.32 });
  seatGroup.addChild(seat);

  const innerRim = new Graphics();
  innerRim
    .ellipse(0, 5, POTTY_METRICS.width / 2 - 12, 10)
    .fill({ color: porcelainShadow, alpha: 0.18 });
  seatGroup.addChild(innerRim);

  const water = new Graphics();
  const drawWater = (color: number, alpha: number) => {
    water.clear();
    water.ellipse(0, 7, POTTY_METRICS.width / 2 - 17, 7).fill({ color, alpha });
  };
  drawWater(POTTY_COLORS.water, 0.65);
  seatGroup.addChild(water);

  const wasteBlob = new Graphics();
  wasteBlob.alpha = 0;
  const wasteBlobBase = { x: 9, y: 5.5 };
  const drawWasteBlob = (color: number, alpha: number) => {
    wasteBlob.clear();
    wasteBlob
      .circle(wasteBlobBase.x, wasteBlobBase.y + 2, 5.8)
      .fill({ color, alpha })
      .circle(wasteBlobBase.x - 5.2, wasteBlobBase.y + 4, 4.3)
      .fill({ color, alpha: alpha * 0.95 })
      .circle(wasteBlobBase.x + 6.1, wasteBlobBase.y + 4.6, 3.6)
      .fill({ color, alpha: alpha * 0.9 });
  };
  drawWasteBlob(0x6b3e26, 0.92);
  seatGroup.addChild(wasteBlob);

  const hole = new Graphics();
  hole
    .ellipse(0, 8, POTTY_METRICS.width / 2 - 25, 4.5)
    .fill({ color: POTTY_COLORS.hole, alpha: 0.55 });
  seatGroup.addChild(hole);

  // Water swirl effect (for flush animation)
  const waterSwirl = new Graphics();
  waterSwirl.alpha = 0;
  seatGroup.addChild(waterSwirl);

  // Seat glow (for "occupied" indicator)
  const seatGlow = new Graphics();
  seatGlow
    .ellipse(0, 0, POTTY_METRICS.width / 2 + 10, 20)
    .fill({ color: theme.chick.bodyPrimary, alpha: 0.35 });
  seatGlow.alpha = 0;
  seatGlow.blendMode = 'add';
  seatGroup.addChildAt(seatGlow, 0);

  // State
  let bowlContents: 'clean' | 'used' = 'clean';
  let flushProgress = 0;
  let handlePressProgress = 0;
  let swirlRotation = 0;
  const bowlClean: { waterColor: number; waterAlpha: number } = { waterColor: POTTY_COLORS.water, waterAlpha: 0.65 };
  const bowlUsed: { waterColor: number; waterAlpha: number } = { waterColor: 0xffe26a, waterAlpha: 0.72 };
  let currentWaterColor: number = bowlClean.waterColor;
  let currentWaterAlpha = bowlClean.waterAlpha;

  const setContents = (contents: 'clean' | 'used') => {
    bowlContents = contents;
    const next = bowlContents === 'used' ? bowlUsed : bowlClean;
    currentWaterColor = next.waterColor;
    currentWaterAlpha = next.waterAlpha;
    drawWater(currentWaterColor, currentWaterAlpha);
    wasteBlob.alpha = bowlContents === 'used' ? 1 : 0;
    wasteBlob.scale.set(1);
    wasteBlob.position.set(0, 0);
  };

  const setFlushProgress = (progress: number) => {
    flushProgress = clamp(progress, 0, 1);
    waterSwirl.clear();

    if (flushProgress > 0 && flushProgress < 0.95) {
      // Draw spinning water swirl
      const radius = 18 * (1 - flushProgress * 0.6);
      const alpha = 0.6 * (1 - flushProgress);

      // Multiple spiral lines
      for (let i = 0; i < 3; i++) {
        const angleOffset = (i / 3) * Math.PI * 2;
        const startAngle = swirlRotation + angleOffset;
        const endAngle = startAngle + Math.PI * 1.2;

        waterSwirl
          .arc(0, 7, radius * (0.45 + i * 0.22), startAngle, endAngle)
          .stroke({ color: currentWaterColor, width: 3 - i * 0.5, alpha: alpha * (1 - i * 0.2) });
      }
      waterSwirl.alpha = 1;
    } else {
      waterSwirl.alpha = 0;
    }

    if (bowlContents === 'used') {
      const fade = clamp(1 - flushProgress * 1.35, 0, 1);
      wasteBlob.alpha = fade;
      wasteBlob.scale.set(1 - flushProgress * 0.35);
      wasteBlob.position.set(-flushProgress * 3, flushProgress * 5);
      if (flushProgress >= 1) setContents('clean');
    }
  };

  const setSeatGlow = (active: boolean) => {
    seatGlow.alpha = active ? 0.5 : 0;
  };

  const setHandlePress = (progress: number) => {
    handlePressProgress = clamp(progress, 0, 1);
    // Rotate handle down when pressed
    handleAnchor.rotation = handlePressProgress * 0.6;
  };

  const update = (deltaMS: number) => {
    // Animate water swirl rotation
    if (flushProgress > 0 && flushProgress < 0.95) {
      swirlRotation += deltaMS * 0.012;
      setFlushProgress(flushProgress); // Redraw with new rotation
    }
  };

  const destroy = () => {
    view.destroy({ children: true });
  };

  return {
    view,
    setContents,
    setFlushProgress,
    setSeatGlow,
    setHandlePress,
    update,
    destroy,
  };
};
