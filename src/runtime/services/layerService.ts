import { Container, type Application } from 'pixi.js';

export type LayerKey = 'environment' | 'particles' | 'overlay' | 'ui' | 'dev';

type LayerRegistrationOptions = {
  key: LayerKey | string;
  container: Container;
  zIndex?: number;
  replace?: boolean;
  visible?: boolean;
};

export type LayerService = {
  register: (options: LayerRegistrationOptions) => Container;
  unregister: (key: LayerKey | string) => void;
  getLayer: (key: LayerKey | string) => Container | undefined;
  withLayer: <T>(key: LayerKey | string, handler: (layer: Container) => T) => T;
  destroy: () => void;
};

const getDefaultLayers = (devMode: boolean): Array<{ key: LayerKey; zIndex: number; setup?: (layer: Container) => void }> => [
  {
    key: 'particles',
    zIndex: 10,
    setup: (layer) => {
      layer.sortableChildren = true;
      layer.eventMode = 'none';
    },
  },
  {
    key: 'overlay',
    zIndex: 20,
    setup: (layer) => {
      layer.sortableChildren = true;
      layer.eventMode = 'none';
    },
  },
  {
    key: 'ui',
    zIndex: 30,
  },
  {
    key: 'dev',
    zIndex: 40,
    setup: (layer) => {
      layer.visible = devMode;
      layer.sortableChildren = true;
      layer.eventMode = 'none';
    },
  },
];

export const createLayerService = (options: { app: Application; devMode?: boolean }): LayerService => {
  const { app, devMode = false } = options;
  const stage = app.stage;
  stage.sortableChildren = true;
  const registry = new Map<string, Container>();

  const register = ({ key, container, zIndex = 0, replace = false, visible }: LayerRegistrationOptions) => {
    const existing = registry.get(key);
    if (existing && !replace && existing !== container) {
      throw new Error(`Layer "${key}" already registered`);
    }
    registry.set(key, container);
    container.zIndex = zIndex;
    if (typeof visible === 'boolean') {
      container.visible = visible;
    }
    if (container.parent !== stage) {
      stage.addChild(container);
    }
    return container;
  };

  const unregister = (key: LayerKey | string) => {
    const entry = registry.get(key);
    if (!entry) {
      return;
    }
    if (entry.parent === stage) {
      stage.removeChild(entry);
    }
    registry.delete(key);
  };

  const getLayer = (key: LayerKey | string) => registry.get(key);

  const withLayer = <T>(key: LayerKey | string, handler: (layer: Container) => T) => {
    const layer = getLayer(key);
    if (!layer) {
      throw new Error(`Layer "${key}" is not registered`);
    }
    return handler(layer);
  };

  const destroy = () => {
    registry.forEach((layer, key) => {
      if (layer.parent === stage) {
        stage.removeChild(layer);
      }
      if (getDefaultLayers(devMode).some((entry) => entry.key === key)) {
        layer.destroy({ children: true });
      }
    });
    registry.clear();
  };

  getDefaultLayers(devMode).forEach(({ key, zIndex, setup }) => {
    const layer = new Container();
    layer.eventMode = 'auto';
    setup?.(layer);
    register({ key, container: layer, zIndex });
  });

  return { register, unregister, getLayer, withLayer, destroy };
};
