import { describe, expect, it, vi } from 'vitest';
import { createPenBounds } from '../../../src/lib/geometry/penBounds';
import {
  createPenBoundsService,
  createSpatialQueryService,
} from '../../../src/runtime/services';

const createBounds = () =>
  createPenBounds({
    frontLeft: { x: 0, y: 30 },
    frontRight: { x: 60, y: 32 },
    backRight: { x: 48, y: -10 },
    backLeft: { x: -8, y: -12 },
  });

const createSource = () => {
  let current = createBounds();
  const listeners = new Set<(bounds: ReturnType<typeof createBounds>) => void>();
  return {
    source: {
      getPenBounds: () => current,
      onPenBoundsChanged: (listener: (bounds: ReturnType<typeof createBounds>) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    emit: (next: ReturnType<typeof createBounds>) => {
      current = next;
      listeners.forEach((listener) => listener(next));
    },
  } as const;
};

describe('penBoundsService', () => {
  it('provides snapshots, emits updates, and exposes helpers', () => {
    const { source, emit } = createSource();
    const spatial = createSpatialQueryService();
    const service = createPenBoundsService({ source, spatial });

    const spy = vi.fn();
    const unsubscribe = service.onChange(spy);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(service.getCenter()).not.toBeNull();
    expect(service.getChickenScale(200)).toBeGreaterThan(0);

    const offBounds = { x: 999, y: 999 };
    const clamped = service.clampPoint(offBounds);
    expect(clamped.x).not.toBe(offBounds.x);
    expect(clamped.y).not.toBe(offBounds.y);

    const nextBounds = createBounds();
    emit(nextBounds);
    expect(spy).toHaveBeenCalledTimes(2);

    expect(service.samplePoint()).not.toBeNull();

    unsubscribe();
    service.destroy();
  });
});
