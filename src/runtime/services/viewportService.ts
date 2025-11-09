import type { Application } from 'pixi.js';

export type ViewportSize = { width: number; height: number };

export type ViewportMetrics = {
  size: ViewportSize;
  center: { x: number; y: number };
  aspectRatio: number;
  dpi: number;
  safeArea: { x: number; y: number; width: number; height: number; padding: number };
};

export type ViewportService = {
  init: () => void;
  destroy: () => void;
  getSize: () => ViewportSize;
  getMetrics: () => ViewportMetrics;
  onResize: (listener: (metrics: ViewportMetrics) => void) => () => void;
  notifyResize: (size: ViewportSize) => void;
};

const hasWindow = typeof window !== 'undefined';

const computeSafeArea = (size: ViewportSize) => {
  const padding = Math.max(16, Math.round(Math.min(size.width, size.height) * 0.04));
  return {
    x: padding,
    y: padding,
    width: Math.max(0, size.width - padding * 2),
    height: Math.max(0, size.height - padding * 2),
    padding,
  };
};

const computeMetrics = (size: ViewportSize): ViewportMetrics => ({
  size,
  center: { x: size.width / 2, y: size.height / 2 },
  aspectRatio: size.width === 0 || size.height === 0 ? 1 : size.width / size.height,
  dpi: hasWindow ? window.devicePixelRatio || 1 : 1,
  safeArea: computeSafeArea(size),
});

export const createViewportService = (options: { app: Application }): ViewportService => {
  const { app } = options;
  let currentSize: ViewportSize = {
    width: app.renderer.width,
    height: app.renderer.height,
  };
  let metrics: ViewportMetrics = computeMetrics(currentSize);
  const listeners = new Set<(payload: ViewportMetrics) => void>();
  let observer: ResizeObserver | null = null;

  const notifyListeners = () => {
    listeners.forEach((listener) => listener(metrics));
  };

  const notifyResize = (size: ViewportSize) => {
    if (size.width === currentSize.width && size.height === currentSize.height) {
      return;
    }
    currentSize = size;
    metrics = computeMetrics(size);
    notifyListeners();
  };

  const handleCanvasResize = (entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }
    const { width, height } = entry.contentRect;
    notifyResize({ width: Math.round(width), height: Math.round(height) });
  };

  const init = () => {
    metrics = computeMetrics(currentSize);
    if (!hasWindow || typeof ResizeObserver === 'undefined') {
      return;
    }
    if (observer) {
      return;
    }
    observer = new ResizeObserver(handleCanvasResize);
    observer.observe(app.canvas);
  };

  const destroy = () => {
    observer?.disconnect();
    observer = null;
    listeners.clear();
  };

  const getSize = () => currentSize;
  const getMetrics = () => metrics;

  const onResize = (listener: (payload: ViewportMetrics) => void) => {
    listeners.add(listener);
    listener(metrics);
    return () => listeners.delete(listener);
  };

  return { init, destroy, getSize, getMetrics, onResize, notifyResize };
};
