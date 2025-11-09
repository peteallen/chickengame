import { Graphics } from 'pixi.js';

export type HorizonDimensions = {
  width: number;
  horizonY: number;
};

export type HorizonLineStyle = {
  color: number;
  alpha: number;
  width: number;
};

export const createHorizonLine = (style: HorizonLineStyle) => {
  const view = new Graphics();

  const draw = ({ width, horizonY }: HorizonDimensions) => {
    view.clear();
    view
      .moveTo(0, horizonY)
      .lineTo(width, horizonY)
      .stroke({
        width: style.width,
        color: style.color,
        alpha: style.alpha,
      });
  };

  return { view, draw } as const;
};
