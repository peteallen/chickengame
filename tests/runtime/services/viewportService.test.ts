import { describe, expect, it, vi } from 'vitest';
import type { Application } from 'pixi.js';
import { createViewportService } from '../../../src/runtime/services';

const createStubApp = (width: number, height: number) => ({
  renderer: { width, height },
  canvas: {} as HTMLCanvasElement,
}) as unknown as Application;

describe('viewportService', () => {
  it('tracks size changes when notifyResize is invoked', () => {
    const app = createStubApp(640, 360);
    const service = createViewportService({ app });
    const listener = vi.fn();
    service.onResize(listener);

    service.notifyResize({ width: 800, height: 450 });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(service.getSize()).toEqual({ width: 800, height: 450 });
    expect(service.getMetrics().aspectRatio).toBeCloseTo(800 / 450);

    service.destroy();
  });
});
