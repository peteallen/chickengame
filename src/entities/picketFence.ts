import { Container, Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';
import type { IsoPoint } from './isometricPlot';

export type FenceLayout = {
  corners: {
    backLeft: IsoPoint;
    backRight: IsoPoint;
    frontRight: IsoPoint;
    frontLeft: IsoPoint;
  };
  postSpacing: number;
  postWidth: number;
  postHeight: number;
  railGap: number;
};

type Edge = {
  start: IsoPoint;
  end: IsoPoint;
  front: boolean;
  includeStart: boolean;
};

export const createPicketFence = (colors: Theme['fence']) => {
  const view = new Container();
  const backLayer = new Graphics();
  const frontLayer = new Graphics();
  view.addChild(backLayer, frontLayer);

  const draw = ({
    corners,
    postSpacing,
    postWidth,
    postHeight,
    railGap,
  }: FenceLayout) => {
    const edges: Edge[] = [
      { start: corners.backLeft, end: corners.backRight, front: false, includeStart: true },
      { start: corners.backRight, end: corners.frontRight, front: false, includeStart: false },
      { start: corners.frontRight, end: corners.frontLeft, front: true, includeStart: false },
      { start: corners.frontLeft, end: corners.backLeft, front: false, includeStart: false },
    ];

    const topRailOffset = Math.max(railGap + 6, postHeight - 12);
    const bottomRailOffset = Math.max(4, topRailOffset - railGap);

    const drawRail = (target: Graphics, edge: Edge, offset: number) => {
      target
        .moveTo(edge.start.x, edge.start.y - offset)
        .lineTo(edge.end.x, edge.end.y - offset)
        .stroke({ color: colors.rail, width: 3, cap: 'round', join: 'round' });
    };

    const drawPost = (target: Graphics, x: number, y: number) => {
      const halfWidth = postWidth / 2;
      const left = x - halfWidth;
      const top = y - postHeight;

      target.rect(left + 1, top + 3, postWidth, postHeight).fill({
        color: colors.shadow,
        alpha: 0.4,
      });

      target.rect(left, top, postWidth, postHeight).fill({ color: colors.post });

      target
        .moveTo(left, top)
        .lineTo(x, top - halfWidth)
        .lineTo(left + postWidth, top)
        .closePath()
        .fill({ color: colors.post });
    };

    const drawPosts = (target: Graphics, edge: Edge) => {
      const dx = edge.end.x - edge.start.x;
      const dy = edge.end.y - edge.start.y;
      const length = Math.hypot(dx, dy);
      const stepCount = Math.max(2, Math.floor(length / postSpacing) + 1);
      for (let i = 0; i < stepCount; i += 1) {
        if (!edge.includeStart && i === 0) {
          continue;
        }

        const t = stepCount === 1 ? 0 : i / (stepCount - 1);
        const x = edge.start.x + dx * t;
        const y = edge.start.y + dy * t;
        drawPost(target, x, y);
      }
    };

    const renderEdgeGroup = (target: Graphics, edgeGroup: Edge[]) => {
      edgeGroup.forEach((edge) => drawRail(target, edge, topRailOffset));
      edgeGroup.forEach((edge) => drawRail(target, edge, bottomRailOffset));
      edgeGroup.forEach((edge) => drawPosts(target, edge));
    };

    const backEdges = edges.filter((edge) => !edge.front);
    const frontEdges = edges.filter((edge) => edge.front);
    backLayer.clear();
    frontLayer.clear();
    renderEdgeGroup(backLayer, backEdges);
    renderEdgeGroup(frontLayer, frontEdges);
  };

  return {
    view,
    layers: {
      back: backLayer,
      front: frontLayer,
    },
    draw,
  } as const;
};
