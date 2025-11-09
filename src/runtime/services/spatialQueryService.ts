import type { PenBounds, PenPoint } from '../../lib/geometry/penBounds';
import {
  clampPointToFootprint,
  clampPointToPen,
  isPointInsidePen,
} from '../../lib/geometry/penBounds';

export type SpatialQueryService = {
  clampToPen: (point: PenPoint, bounds: PenBounds) => PenPoint;
  clampToFootprint: (point: PenPoint, bounds: PenBounds) => PenPoint;
  isPointInsidePen: (point: PenPoint, bounds: PenBounds) => boolean;
  getPenCenter: (bounds: PenBounds) => PenPoint;
  getFrontWidth: (bounds: PenBounds) => number;
  samplePointInPen: (bounds: PenBounds) => PenPoint;
  midpoint: (a: PenPoint, b: PenPoint) => PenPoint;
  computeChickenScale: (
    bounds: PenBounds,
    options: { nominalWidth: number; minScale?: number; maxScale?: number }
  ) => number;
};

const midpoint = (a: PenPoint, b: PenPoint): PenPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const getFrontWidth = (bounds: PenBounds): number => {
  const { frontLeft, frontRight } = bounds.polygon;
  return Math.hypot(frontRight.x - frontLeft.x, frontRight.y - frontLeft.y);
};

const samplePointInPen = (bounds: PenBounds): PenPoint => {
  const { frontLeft, frontRight, backRight, backLeft } = bounds.polygon;
  const triangles: [PenPoint, PenPoint, PenPoint][] = [
    [frontLeft, frontRight, backRight],
    [frontLeft, backRight, backLeft],
  ];
  const tri = triangles[Math.floor(Math.random() * triangles.length)];
  const r1 = Math.random();
  const r2 = Math.random();
  const sqrtR1 = Math.sqrt(r1);
  const u = 1 - sqrtR1;
  const v = sqrtR1 * (1 - r2);
  const w = sqrtR1 * r2;
  return {
    x: tri[0].x * u + tri[1].x * v + tri[2].x * w,
    y: tri[0].y * u + tri[1].y * v + tri[2].y * w,
  };
};

const computeChickenScale = (
  bounds: PenBounds,
  options: { nominalWidth: number; minScale?: number; maxScale?: number },
): number => {
  const { nominalWidth, minScale = 0.35, maxScale = 1.35 } = options;
  const frontWidth = getFrontWidth(bounds);
  const desiredWidth = frontWidth * 0.22;
  const rawScale = desiredWidth / Math.max(1, nominalWidth);
  return Math.max(minScale, Math.min(maxScale, rawScale));
};

export const createSpatialQueryService = (): SpatialQueryService => ({
  clampToPen: (point, bounds) => clampPointToPen(point, bounds),
  clampToFootprint: (point, bounds) => clampPointToFootprint(point, bounds),
  isPointInsidePen: (point, bounds) => isPointInsidePen(point, bounds),
  getPenCenter: (bounds) => {
    const { polygon } = bounds;
    const frontMid = midpoint(polygon.frontLeft, polygon.frontRight);
    const backMid = midpoint(polygon.backLeft, polygon.backRight);
    return midpoint(frontMid, backMid);
  },
  getFrontWidth,
  samplePointInPen,
  midpoint,
  computeChickenScale,
});
