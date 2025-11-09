import { Container } from 'pixi.js';
import { createGrassField } from '../entities/grassField';
import { createPicketFence } from '../entities/picketFence';
import { createBarn } from '../entities/barn';
import type { Theme } from '../config/theme';
import type { EnvironmentConfig } from '../config/environment';
import {
  createPenBounds,
  type PenBounds,
  type PenPolygon,
} from '../lib/geometry/penBounds';

export type EnvironmentScene = {
  container: Container;
  penLayer: Container;
  layout: (size: { width: number; height: number }) => void;
  getPenBounds: () => PenBounds | null;
  onPenBoundsChanged: (listener: (bounds: PenBounds) => void) => () => void;
};

export const createEnvironmentScene = (
  theme: Theme,
  environment: EnvironmentConfig,
): EnvironmentScene => {
  const container = new Container();
  const grass = createGrassField(theme.grass);
  const fence = createPicketFence(theme.fence);
  const barn = createBarn(theme.barn);
  const penLayer = new Container();
  penLayer.sortableChildren = true;
  fence.view.addChildAt(penLayer, 1);
  let penBounds: PenBounds | null = null;
  const penBoundsListeners = new Set<(bounds: PenBounds) => void>();

  const notifyPenBounds = () => {
    if (!penBounds) {
      return;
    }
    penBoundsListeners.forEach((listener) => listener(penBounds as PenBounds));
  };

  // Ensure Z-order: background grass, barn silhouette, then fence on top
  container.addChild(grass.view, barn.view, fence.view);

  const layout = ({ width, height }: { width: number; height: number }) => {
    const {
      plot: plotConfig,
      fence: fenceConfig,
      field: fieldConfig,
    } = environment;

    const horizonRatio = Math.min(0.9, Math.max(0.05, fieldConfig.horizonRatio));
    const horizonY = height * horizonRatio;

    // Full field stays grass; padding keeps it extending past edges, but sky remains transparent.
    grass.draw({ width, height, padding: fieldConfig.padding, horizonY });

    const centerX = width / 2;

    // Base geometric ratios
    const rawPenFrontWidth = width * plotConfig.widthRatio;
    const rawPenBackWidth = rawPenFrontWidth * plotConfig.backScale;
    const rawPenDepth = rawPenFrontWidth * plotConfig.depthRatio;

    const rawFenceFrontWidth = rawPenFrontWidth + fenceConfig.offset * 2.2;
    const rawFenceBackWidth = rawPenBackWidth + fenceConfig.offset * 1.2;
    const rawFenceDepth = rawPenDepth + fenceConfig.offset * 0.9;

    // Fit the fence within horizontal viewport padding
    const maxFrontWidth = Math.max(1, width - fenceConfig.viewportPaddingX * 2);
    const widthScale = Math.min(1, maxFrontWidth / rawFenceFrontWidth);

    let penFrontWidth = rawPenFrontWidth * widthScale;
    let penBackWidth = rawPenBackWidth * widthScale;
    let penDepth = rawPenDepth * widthScale;
    let fenceFrontWidth = rawFenceFrontWidth * widthScale;
    let fenceBackWidth = rawFenceBackWidth * widthScale;
    let fenceDepth = rawFenceDepth * widthScale;

    // Raise the whole composition to reduce bottom margin and increase sky
    const maxBaseY = height - fenceConfig.viewportPaddingY;
    const groundGap = fenceConfig.minGroundGap;
    const fenceBaseOffset = fenceConfig.offset * 0.05;
    let baseY = Math.min(
      maxBaseY,
      height * (1 - plotConfig.baseFromBottom) - height * 0.06,
    );

    // Ensure depth fits between top padding and base
    const maxDepth = Math.max(1, baseY - fenceConfig.viewportPaddingY * 1.1);
    if (penDepth > maxDepth) {
      const depthScale = maxDepth / penDepth;
      penDepth *= depthScale;
      fenceDepth *= depthScale;
    }

    // Respect horizon: keep the entire pen below the sky line
    const availablePenDepth = Math.max(1, maxBaseY - (horizonY + groundGap));
    const availableFenceDepth = Math.max(1, availablePenDepth + fenceBaseOffset);
    const horizonDepthScale = Math.min(
      1,
      availablePenDepth / Math.max(1, penDepth),
      availableFenceDepth / Math.max(1, fenceDepth),
    );

    if (horizonDepthScale < 1) {
      penDepth *= horizonDepthScale;
      fenceDepth *= horizonDepthScale;
    }

    const minBaseYForPen = horizonY + groundGap + penDepth;
    const minBaseYForFence = horizonY + groundGap + fenceDepth - fenceBaseOffset;
    const minBaseY = Math.min(maxBaseY, Math.max(minBaseYForPen, minBaseYForFence));
    baseY = Math.min(maxBaseY, Math.max(minBaseY, baseY));

    // Fence is aligned tightly with the plot front so posts do not float into sky
    let fenceBaseY = baseY + fenceBaseOffset;
    let fenceBackY = fenceBaseY - fenceDepth;

    // Final safety: keep everything within bottom padding (rounding can drift)
    if (baseY > maxBaseY) {
      const delta = baseY - maxBaseY;
      baseY -= delta;
      fenceBaseY -= delta;
      fenceBackY -= delta;
    }

    let penBackY = baseY - penDepth;
    if (penBackY < horizonY + groundGap) {
      const delta = horizonY + groundGap - penBackY;
      baseY += delta;
      fenceBaseY += delta;
      fenceBackY += delta;
      if (baseY > maxBaseY) {
        const correction = baseY - maxBaseY;
        baseY -= correction;
        fenceBaseY -= correction;
        fenceBackY -= correction;
      }
      penBackY = baseY - penDepth;
    }

    const penCorners: PenPolygon = {
      frontLeft: { x: centerX - penFrontWidth / 2, y: baseY },
      frontRight: { x: centerX + penFrontWidth / 2, y: baseY },
      backRight: { x: centerX + penBackWidth / 2, y: penBackY },
      backLeft: { x: centerX - penBackWidth / 2, y: penBackY },
    };

    const barnWidth = Math.max(90, Math.min(200, width * 0.2));
    const fenceFrontLeftX = centerX - fenceFrontWidth / 2;
    const fenceClearance = Math.max(36, fenceConfig.viewportPaddingX * 0.55);
    const gapLeftEdge = Math.max(
      barnWidth * 0.1,
      fenceConfig.viewportPaddingX * 0.35,
      fieldConfig.padding * 0.4,
    );
    const gapRightEdge = Math.max(gapLeftEdge + barnWidth, fenceFrontLeftX - fenceClearance);
    const rawGapCenter = gapLeftEdge + (gapRightEdge - gapLeftEdge) / 2;
    const minCenter = gapLeftEdge + barnWidth / 2;
    const maxCenter = gapRightEdge - barnWidth / 2;
    const barnCenterX = Math.min(maxCenter, Math.max(minCenter, rawGapCenter));

    const approxBarnHeight = barnWidth * 1.06;
    const skyOverlap = Math.max(16, barnWidth * 0.12);
    const minBarnBaseY = horizonY + Math.max(10, approxBarnHeight * 0.18);
    const maxBarnBaseYFromGround = baseY - groundGap * 0.35;
    const maxBarnBaseYForOverlap = horizonY + approxBarnHeight - skyOverlap;
    const targetOffset = Math.max(16, (baseY - horizonY) * 0.25);
    let barnBaseY = horizonY + targetOffset;
    barnBaseY = Math.min(barnBaseY, maxBarnBaseYFromGround);
    barnBaseY = Math.min(barnBaseY, maxBarnBaseYForOverlap);
    barnBaseY = Math.max(minBarnBaseY, barnBaseY);

    barn.draw({
      centerX: barnCenterX,
      baseY: barnBaseY,
      width: barnWidth,
      horizonY,
    });

    fence.draw({
      corners: {
        frontLeft: { x: centerX - fenceFrontWidth / 2, y: fenceBaseY },
        frontRight: { x: centerX + fenceFrontWidth / 2, y: fenceBaseY },
        backRight: { x: centerX + fenceBackWidth / 2, y: fenceBackY },
        backLeft: { x: centerX - fenceBackWidth / 2, y: fenceBackY },
      },
      postSpacing: fenceConfig.postSpacing,
      postWidth: fenceConfig.postWidth,
      postHeight: fenceConfig.postHeight,
      railGap: fenceConfig.railGap,
    });

    penBounds = createPenBounds(penCorners);
    notifyPenBounds();
  };

  return {
    container,
    penLayer,
    layout,
    getPenBounds: () => penBounds,
    onPenBoundsChanged: (listener: (bounds: PenBounds) => void) => {
      penBoundsListeners.add(listener);
      if (penBounds) {
        listener(penBounds);
      }
      return () => penBoundsListeners.delete(listener);
    },
  };
};
