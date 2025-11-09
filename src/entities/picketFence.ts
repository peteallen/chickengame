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
  depthEdge?: boolean;
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
      {
        start: corners.backRight,
        end: corners.frontRight,
        front: false,
        includeStart: false,
        depthEdge: true,
      },
      { start: corners.frontRight, end: corners.frontLeft, front: true, includeStart: false },
      {
        start: corners.frontLeft,
        end: corners.backLeft,
        front: false,
        includeStart: false,
        depthEdge: true,
      },
    ];

    const polygonCenter: IsoPoint = {
      x:
        (corners.backLeft.x +
          corners.backRight.x +
          corners.frontRight.x +
          corners.frontLeft.x) /
        4,
      y:
        (corners.backLeft.y +
          corners.backRight.y +
          corners.frontRight.y +
          corners.frontLeft.y) /
        4,
    };

    const railWidth = 9;
    const railCount = 2;
    const faceInsetPadding = Math.min(Math.max(railGap * 0.05, 1), postWidth * 0.15);
    const railRatios =
      railCount <= 0
        ? []
        : Array.from({ length: railCount }, (_, index) => (index + 1) / (railCount + 1));

    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const computePostHeight = (_y: number) => postHeight;

    const computeEdgeGeometry = (edge: Edge) => {
      const dx = edge.end.x - edge.start.x;
      const dy = edge.end.y - edge.start.y;
      const length = Math.hypot(dx, dy) || 1;
      const dirX = dx / length;
      const dirY = dy / length;
      let normalX = -dirY;
      let normalY = dirX;
      const midPoint = {
        x: (edge.start.x + edge.end.x) / 2,
        y: (edge.start.y + edge.end.y) / 2,
      };
      const toCenter = {
        x: polygonCenter.x - midPoint.x,
        y: polygonCenter.y - midPoint.y,
      };
      if (normalX * toCenter.x + normalY * toCenter.y < 0) {
        normalX *= -1;
        normalY *= -1;
      }
      const maxTrim = Math.max(0, length / 2 - 1);
      const faceInset = Math.max(0, Math.min(postWidth / 2 - faceInsetPadding, maxTrim));
      const trimmedStart: IsoPoint = {
        x: edge.start.x + dirX * faceInset,
        y: edge.start.y + dirY * faceInset,
      };
      const trimmedEnd: IsoPoint = {
        x: edge.end.x - dirX * faceInset,
        y: edge.end.y - dirY * faceInset,
      };
      return { trimmedStart, trimmedEnd };
    };

    const edgeGeometry = new Map<Edge, ReturnType<typeof computeEdgeGeometry>>();
    edges.forEach((edge) => {
      edgeGeometry.set(edge, computeEdgeGeometry(edge));
    });

    const computeRailOffset = (height: number, ratio: number) => {
      if (height <= 0) {
        return 0;
      }
      const guard = Math.max(railWidth * 0.5, 2);
      const minOffset = Math.min(guard, height - guard);
      const maxOffset = Math.max(guard, height - guard);
      return clamp(ratio * height, minOffset, maxOffset);
    };

    const drawRail = (target: Graphics, edge: Edge, offsetRatio: number) => {
      const geometry = edgeGeometry.get(edge);
      if (!geometry) {
        return;
      }
      const startHeight = computePostHeight(edge.start.y);
      const endHeight = computePostHeight(edge.end.y);
      const startOffset = computeRailOffset(startHeight, offsetRatio);
      const endOffset = computeRailOffset(endHeight, offsetRatio);
      const startBaseX = geometry.trimmedStart.x;
      const startBaseY = geometry.trimmedStart.y;
      const endBaseX = geometry.trimmedEnd.x;
      const endBaseY = geometry.trimmedEnd.y;

      target
        .moveTo(startBaseX, startBaseY - startOffset)
        .lineTo(endBaseX, endBaseY - endOffset)
        .stroke({ color: colors.rail, width: railWidth, cap: 'round', join: 'round' });
    };

    const drawPost = (target: Graphics, x: number, y: number, height: number) => {
      const halfWidth = postWidth / 2;
      const left = x - halfWidth;
      const top = y - height;

      target.rect(left + 1, top + 3, postWidth, height).fill({
        color: colors.shadow,
        alpha: 0.4,
      });

      target.rect(left, top, postWidth, height).fill({ color: colors.post });

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
        drawPost(target, x, y, computePostHeight(y));
      }
    };

    const renderEdgeGroup = (target: Graphics, edgeGroup: Edge[]) => {
      railRatios.forEach((ratio) => {
        edgeGroup.forEach((edge) => drawRail(target, edge, ratio));
      });
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
