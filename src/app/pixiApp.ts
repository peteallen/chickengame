import { Application, type ApplicationOptions } from 'pixi.js';

export const createPixiApp = () => new Application();

export const initPixiApp = async (
  app: Application,
  options: Partial<ApplicationOptions>,
): Promise<void> => {
  await app.init({ antialias: true, ...options });
};
