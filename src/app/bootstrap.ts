import { type Ticker } from 'pixi.js';
import { environment, theme } from '../config';
import { createGameRuntime } from '../runtime/gameRuntime';
import { createPixiApp, initPixiApp } from './pixiApp';

type BootstrapOptions = {
  devMode?: boolean;
};

export const bootstrap = async (options: BootstrapOptions = {}) => {
  const { devMode = false } = options;
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    throw new Error('Unable to find #app container');
  }

  const app = createPixiApp();
  await initPixiApp(app, {
    background: theme.sky,
    resizeTo: window,
  });

  root.replaceChildren(app.canvas);
  const runtime = createGameRuntime({
    app,
    root,
    theme,
    environment,
    devMode,
  });

  const handleResize = () => {
    runtime.layout({
      width: app.renderer.width,
      height: app.renderer.height,
    });
  };
  handleResize();
  window.addEventListener('resize', handleResize);

  runtime.start();

  const handleTick = (ticker: Ticker) => {
    runtime.update(ticker.deltaMS);
  };
  app.ticker.add(handleTick);

  return {
    app,
    runtime,
    destroy: () => {
      window.removeEventListener('resize', handleResize);
      app.ticker.remove(handleTick);
      runtime.destroy();
    },
  } as const;
};
