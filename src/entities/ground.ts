import { Graphics } from 'pixi.js';

export type GroundDimensions = {
  width: number;
  height: number;
  horizonY: number;
};

export const createGround = (color: number) => {
  const view = new Graphics();

  const draw = ({ width, height, horizonY }: GroundDimensions) => {
    view.clear();
    view.rect(0, horizonY, width, height - horizonY).fill({ color });
  };

  return { view, draw } as const;
};
