import type { Container, PointData } from 'pixi.js';
import type { PenBounds } from '../lib/geometry/penBounds';
import type { SpatialQueryService } from '../runtime/services';

export type ConstraintMode = 'pen' | 'none';
export type ConstraintBehavior = 'clamp' | 'bounce';

export type Constrainable = {
  target: Container;
  mode?: ConstraintMode;
  behavior?: ConstraintBehavior;
  velocity?: { x: number; y: number };
  bounceDamping?: number;
  clampVelocityMultiplier?: number;
};

export type PenConstraintSystemOptions = {
  getPenBounds: () => PenBounds | null;
  defaultBehavior: ConstraintBehavior;
  bounceDamping: number;
  clampVelocityMultiplier: number;
  spatial: SpatialQueryService;
};

type InternalEntry = Constrainable & {
  lastPosition: PointData;
};

const normalize = (vector: PointData): PointData => {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude === 0) {
    return { x: 0, y: -1 };
  }
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
};

export type PenConstraintSystem = {
  register: (entry: Constrainable) => void;
  unregister: (target: Container) => void;
  clear: () => void;
  update: (deltaMS: number) => void;
};

export const createPenConstraintSystem = (
  options: PenConstraintSystemOptions,
): PenConstraintSystem => {
  const registry = new Map<Container, InternalEntry>();

  const register = (entry: Constrainable) => {
    registry.set(entry.target, {
      ...entry,
      lastPosition: {
        x: entry.target.position.x,
        y: entry.target.position.y,
      },
    });
  };

  const unregister = (target: Container) => {
    registry.delete(target);
  };

  const clear = () => {
    registry.clear();
  };

  const resolveClamp = (entry: InternalEntry, bounds: PenBounds) => {
    const resolved = options.spatial.clampToPen(entry.target.position, bounds);
    entry.target.position.set(resolved.x, resolved.y);
    if (entry.velocity) {
      const multiplier = entry.clampVelocityMultiplier ?? options.clampVelocityMultiplier;
      entry.velocity.x *= multiplier;
      entry.velocity.y *= multiplier;
    }
    entry.lastPosition = { ...resolved };
  };

  const resolveBounce = (entry: InternalEntry, bounds: PenBounds) => {
    if (!entry.velocity) {
      resolveClamp(entry, bounds);
      return;
    }

    const resolved = options.spatial.clampToPen(entry.target.position, bounds);
    const normal = normalize({
      x: entry.target.position.x - resolved.x,
      y: entry.target.position.y - resolved.y,
    });

    const dot = entry.velocity.x * normal.x + entry.velocity.y * normal.y;
    const reflected = {
      x: entry.velocity.x - 2 * dot * normal.x,
      y: entry.velocity.y - 2 * dot * normal.y,
    };

    const damping = entry.bounceDamping ?? options.bounceDamping;
    entry.velocity.x = reflected.x * damping;
    entry.velocity.y = reflected.y * damping;

    entry.target.position.set(resolved.x, resolved.y);
    entry.lastPosition = { ...resolved };
  };

  const update = () => {
    const bounds = options.getPenBounds();
    if (!bounds) {
      return;
    }

    registry.forEach((entry) => {
      if (entry.mode === 'none') {
        entry.lastPosition = {
          x: entry.target.position.x,
          y: entry.target.position.y,
        };
        return;
      }

      const position = entry.target.position;
      const point = { x: position.x, y: position.y };
      if (options.spatial.isPointInsidePen(point, bounds)) {
        entry.lastPosition = point;
        return;
      }

      const behavior = entry.behavior ?? options.defaultBehavior;
      if (behavior === 'bounce') {
        resolveBounce(entry, bounds);
      } else {
        resolveClamp(entry, bounds);
      }
    });
  };

  return { register, unregister, clear, update };
};
