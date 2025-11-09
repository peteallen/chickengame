import type { Container } from 'pixi.js';

export type DepthRegistration = {
  target: Container;
  /**
   * Higher layers are always rendered in front of lower layers, regardless of depth.
   */
  layer?: number;
  /**
   * Manual offset added after depth to break ties between peers.
   */
  bias?: number;
  /**
   * Custom multiplier for the depth contribution.
   */
  depthScale?: number;
  /**
   * Provide a dynamic depth value. Defaults to the target's y position.
   */
  getDepth?: () => number;
  /**
   * Static depth used when getDepth is omitted.
   */
  staticDepth?: number;
};

export type RenderDepthSystem = {
  register: (entry: DepthRegistration) => void;
  unregister: (target: Container) => void;
  update: () => void;
  clear: () => void;
  destroy: () => void;
};

type InternalEntry = Required<Pick<DepthRegistration, 'target'>> & {
  layer: number;
  bias: number;
  depthScale?: number;
  getDepth?: () => number;
  staticDepth?: number;
};

type RenderDepthSystemOptions = {
  /**
   * Amount of zIndex space reserved per layer so they never overlap.
   */
  layerStride?: number;
  /**
   * Default multiplier applied to depth readings.
   */
  defaultDepthScale?: number;
};

const DEFAULT_LAYER_STRIDE = 10_000;
const DEFAULT_DEPTH_SCALE = 1;

const sanitizeNumber = (value: number) => (Number.isFinite(value) ? value : 0);

export const createRenderDepthSystem = (
  options: RenderDepthSystemOptions = {},
): RenderDepthSystem => {
  const layerStride = options.layerStride ?? DEFAULT_LAYER_STRIDE;
  const defaultDepthScale = options.defaultDepthScale ?? DEFAULT_DEPTH_SCALE;
  const registry = new Map<Container, InternalEntry>();

  const resolveDepth = (entry: InternalEntry): number => {
    if (entry.getDepth) {
      return sanitizeNumber(entry.getDepth());
    }
    if (typeof entry.staticDepth === 'number') {
      return sanitizeNumber(entry.staticDepth);
    }
    return sanitizeNumber(entry.target.position.y);
  };

  const applyDepth = (entry: InternalEntry) => {
    if ((entry.target as unknown as { destroyed?: boolean }).destroyed) {
      registry.delete(entry.target);
      return;
    }
    const depthValue = resolveDepth(entry);
    const scale = entry.depthScale ?? defaultDepthScale;
    const layerBase = entry.layer * layerStride;
    entry.target.zIndex = layerBase + depthValue * scale + entry.bias;
  };

  const register = (entry: DepthRegistration) => {
    const stored: InternalEntry = {
      target: entry.target,
      layer: entry.layer ?? 0,
      bias: entry.bias ?? 0,
      depthScale: entry.depthScale,
      getDepth: entry.getDepth,
      staticDepth: entry.staticDepth,
    };
    registry.set(entry.target, stored);
    applyDepth(stored);
  };

  const unregister = (target: Container) => {
    registry.delete(target);
  };

  const update = () => {
    registry.forEach(applyDepth);
  };

  const clear = () => {
    registry.clear();
  };

  const destroy = () => {
    registry.clear();
  };

  return {
    register,
    unregister,
    update,
    clear,
    destroy,
  };
};
