import { Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';

export type IsoPoint = { x: number; y: number };

export type PlotLayout = {
  frontLeft: IsoPoint;
  frontRight: IsoPoint;
  backRight: IsoPoint;
  backLeft: IsoPoint;
  thickness: number;
};

const drawFace = (view: Graphics, points: IsoPoint[], color: number, alpha = 1) => {
  view.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    view.lineTo(points[i].x, points[i].y);
  }
  view.closePath();
  view.fill({ color, alpha });
};

export const createIsometricPlot = (colors: Theme['farm']) => {
  const view = new Graphics();

  const draw = ({ frontLeft, frontRight, backRight, backLeft, thickness }: PlotLayout) => {
    view.clear();

    const extrude = (point: IsoPoint): IsoPoint => ({ x: point.x, y: point.y + thickness });

    const frontLeftDrop = extrude(frontLeft);
    const frontRightDrop = extrude(frontRight);
    const backRightDrop = extrude(backRight);
    const backLeftDrop = extrude(backLeft);

    drawFace(view, [backLeft, backRight, frontRight, frontLeft], colors.top);
    drawFace(view, [frontRight, frontRightDrop, frontLeftDrop, frontLeft], colors.right, 0.9);
    drawFace(view, [backRight, backRightDrop, frontRightDrop, frontRight], colors.right, 0.8);
    drawFace(view, [backLeft, frontLeft, frontLeftDrop, backLeftDrop], colors.left, 0.95);

    view
      .moveTo(frontLeftDrop.x - thickness * 0.3, frontLeftDrop.y + thickness * 0.2)
      .lineTo(frontRightDrop.x + thickness * 0.4, frontRightDrop.y + thickness * 0.3)
      .stroke({ color: colors.shadow, width: thickness * 0.5, alpha: 0.35 });

    view
      .moveTo(backLeft.x, backLeft.y)
      .lineTo(backRight.x, backRight.y)
      .lineTo(frontRight.x, frontRight.y)
      .lineTo(frontLeft.x, frontLeft.y)
      .closePath()
      .stroke({ color: colors.edge, width: 3, join: 'round' });
  };

  return { view, draw } as const;
};
