import type { PenBounds, PenPoint } from '../../lib/geometry/penBounds';
import type { SpatialQueryService } from './spatialQueryService';

export type PenBoundsSource = {
  getPenBounds: () => PenBounds | null;
  onPenBoundsChanged: (listener: (bounds: PenBounds) => void) => () => void;
};

export type PenBoundsSnapshot = {
  bounds: PenBounds;
  center: PenPoint;
  frontWidth: number;
};

export type PenBoundsService = {
  getSnapshot: () => PenBoundsSnapshot | null;
  getBounds: () => PenBounds | null;
  getCenter: () => PenPoint | null;
  getChickenScale: (nominalWidth: number) => number;
  clampPoint: (point: PenPoint) => PenPoint;
  samplePoint: () => PenPoint | null;
  onChange: (listener: (snapshot: PenBoundsSnapshot) => void) => () => void;
  destroy: () => void;
};

const createSnapshot = (
  bounds: PenBounds,
  spatial: SpatialQueryService,
): PenBoundsSnapshot => ({
  bounds,
  center: spatial.getPenCenter(bounds),
  frontWidth: spatial.getFrontWidth(bounds),
});

export const createPenBoundsService = (options: {
  source: PenBoundsSource;
  spatial: SpatialQueryService;
}): PenBoundsService => {
  const { source, spatial } = options;
  let snapshot: PenBoundsSnapshot | null = null;
  const listeners = new Set<(value: PenBoundsSnapshot) => void>();
  const detach = source.onPenBoundsChanged((bounds) => {
    snapshot = createSnapshot(bounds, spatial);
    listeners.forEach((listener) => listener(snapshot as PenBoundsSnapshot));
  });

  const getSnapshot = () => snapshot;
  const getBounds = () => snapshot?.bounds ?? null;
  const getCenter = () => snapshot?.center ?? null;

  const getChickenScale = (nominalWidth: number) => {
    if (!snapshot) {
      return 1;
    }
    return spatial.computeChickenScale(snapshot.bounds, { nominalWidth });
  };

  const clampPoint = (point: PenPoint) => {
    if (!snapshot) {
      return { ...point };
    }
    return spatial.clampToPen(point, snapshot.bounds);
  };

  const samplePoint = () => {
    if (!snapshot) {
      return null;
    }
    return spatial.samplePointInPen(snapshot.bounds);
  };

  const onChange = (listener: (value: PenBoundsSnapshot) => void) => {
    listeners.add(listener);
    if (!snapshot) {
      const bounds = source.getPenBounds();
      if (bounds) {
        snapshot = createSnapshot(bounds, spatial);
      }
    }
    if (snapshot) {
      listener(snapshot);
    }
    return () => listeners.delete(listener);
  };

  const destroy = () => {
    detach?.();
    listeners.clear();
    snapshot = null;
  };

  // Seed snapshot eagerly if bounds already exist.
  const initialBounds = source.getPenBounds();
  if (initialBounds) {
    snapshot = createSnapshot(initialBounds, spatial);
  }

  return {
    getSnapshot,
    getBounds,
    getCenter,
    getChickenScale,
    clampPoint,
    samplePoint,
    onChange,
    destroy,
  };
};
