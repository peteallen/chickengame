import type { PointData } from 'pixi.js';

export type PenPoint = PointData;

export type PenPolygon = {
  frontLeft: PenPoint;
  frontRight: PenPoint;
  backRight: PenPoint;
  backLeft: PenPoint;
};

export type PenBounds = {
  polygon: PenPolygon;
  footprint: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
};

const polygonPoints = (polygon: PenPolygon): PenPoint[] => [
  polygon.frontLeft,
  polygon.frontRight,
  polygon.backRight,
  polygon.backLeft,
];

const cross = (a: PenPoint, b: PenPoint, c: PenPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

export const createPenBounds = (polygon: PenPolygon): PenBounds => {
  const points = polygonPoints(polygon);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    polygon,
    footprint: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    },
  };
};

export const isPointInsidePen = (point: PenPoint, bounds: PenBounds): boolean => {
  const points = polygonPoints(bounds.polygon);
  let hasPos = false;
  let hasNeg = false;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const value = cross(a, b, point);
    if (value < 0) {
      hasNeg = true;
    } else if (value > 0) {
      hasPos = true;
    }
    if (hasNeg && hasPos) {
      return false;
    }
  }
  return true;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const closestPointOnSegment = (start: PenPoint, end: PenPoint, point: PenPoint): PenPoint => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return { x: start.x, y: start.y };
  }
  const t = clamp01(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq);
  return {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
};

const distanceSq = (a: PenPoint, b: PenPoint) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const clampPointToPen = (point: PenPoint, bounds: PenBounds): PenPoint => {
  if (isPointInsidePen(point, bounds)) {
    return { x: point.x, y: point.y };
  }

  const points = polygonPoints(bounds.polygon);
  let closest = points[0];
  let minDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    const candidate = closestPointOnSegment(start, end, point);
    const dist = distanceSq(candidate, point);
    if (dist < minDistance) {
      minDistance = dist;
      closest = candidate;
    }
  }

  return closest;
};

export const clampPointToFootprint = (point: PenPoint, bounds: PenBounds): PenPoint => ({
  x: Math.max(bounds.footprint.minX, Math.min(bounds.footprint.maxX, point.x)),
  y: Math.max(bounds.footprint.minY, Math.min(bounds.footprint.maxY, point.y)),
});
