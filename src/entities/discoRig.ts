import { Container, Graphics } from 'pixi.js';
import { clampPointToPen, type PenBounds } from '../lib/geometry/penBounds';

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

export type DiscoRig = {
  view: Container;
  layout: (size: { width: number; height: number }) => void;
  setEnabled: (enabled: boolean) => void;
  setPulseStrength: (strength: number) => void;
  setPenBounds: (bounds: PenBounds | null) => void;
  update: (deltaMS: number) => void;
  destroy: () => void;
};

type BeamTarget = { x: number; y: number };

type Beam = {
  container: Container;
  swaySpeed: number;
  swayOffset: number;
  intensity: number;
  baseLength: number;
  spot: Graphics;
  anchor: BeamTarget;
  target: BeamTarget;
  wanderRadius: number;
  anchorTimer: number;
};

type Fixture = {
  container: Container;
  beam: Beam;
  offsetRatio: number;
};

const createBeamGraphic = (color: number, width: number, length: number): Container => {
  const container = new Container();
  const beam = new Graphics();
  beam
    .moveTo(-width / 2, 0)
    .lineTo(width / 2, 0)
    .lineTo(width * 0.18, length)
    .lineTo(-width * 0.18, length)
    .closePath()
    .fill({ color, alpha: 0.55 });

  const highlight = new Graphics();
  highlight
    .moveTo(-width * 0.2, 0)
    .lineTo(width * 0.2, 0)
    .lineTo(width * 0.04, length)
    .lineTo(-width * 0.04, length)
    .closePath()
    .fill({ color: 0xffffff, alpha: 0.08 });

  container.addChild(beam, highlight);
  container.alpha = 0;
  return container;
};

const createGlowSpot = (color: number, radius: number) => {
  const spot = new Graphics();
  const outerRadius = radius;
  const innerRadius = radius * 0.45;
  spot
    .circle(0, 0, outerRadius)
    .fill({ color, alpha: 0.22 })
    .circle(0, 0, innerRadius)
    .fill({ color, alpha: 0.45 });
  spot.pivot.set(0, 0);
  spot.alpha = 0;
  spot.blendMode = 'screen';
  return spot;
};

const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

const clonePoint = (point: BeamTarget): BeamTarget => ({ x: point.x, y: point.y });

const randomPointInTriangle = (a: BeamTarget, b: BeamTarget, c: BeamTarget): BeamTarget => {
  const r1 = Math.random();
  const r2 = Math.random();
  const sqrtR1 = Math.sqrt(r1);
  const u = 1 - sqrtR1;
  const v = sqrtR1 * (1 - r2);
  const w = sqrtR1 * r2;
  return {
    x: a.x * u + b.x * v + c.x * w,
    y: a.y * u + b.y * v + c.y * w,
  };
};

const samplePointInsidePen = (bounds: PenBounds): BeamTarget => {
  const { frontLeft, frontRight, backRight, backLeft } = bounds.polygon;
  const triangles: [BeamTarget, BeamTarget, BeamTarget][] = [
    [frontLeft, frontRight, backRight],
    [frontLeft, backRight, backLeft],
  ];
  const tri = triangles[Math.floor(Math.random() * triangles.length)];
  return randomPointInTriangle(tri[0], tri[1], tri[2]);
};

export const createDiscoRig = (): DiscoRig => {
  const view = new Container();
  view.sortableChildren = true;
  view.eventMode = 'none';
  view.alpha = 0;
  view.visible = false;

  const dimmer = new Graphics();
  dimmer.zIndex = 0;
  const floorGlow = new Graphics();
  floorGlow.zIndex = 0.4;

  const spotLayer = new Container();
  spotLayer.zIndex = 0.5;
  spotLayer.blendMode = 'screen';

  const barContainer = new Container();
  barContainer.zIndex = 1;
  const barGraphic = new Graphics();
  const fixtureLayer = new Container();
  fixtureLayer.sortableChildren = true;
  barContainer.addChild(barGraphic, fixtureLayer);

  view.addChild(dimmer, floorGlow, spotLayer, barContainer);

  let viewport = { width: 0, height: 0 };
  let penBounds: PenBounds | null = null;
  let enabled = false;
  let targetAlpha = 0;
  let currentAlpha = 0;
  let pulse = 0;
  let pulseTarget = 0;
  let barWidth = 0;
  let barHeight = 0;
  let barRestY = 0;
  let barHiddenY = -120;
  let barProgress = 0;
  let barTargetProgress = 0;

  const beams: Beam[] = [];
  const fixtures: Fixture[] = [];
  const palette = [0xff5fd2, 0x6c5dff, 0x3fe9ff, 0xfff56e, 0xff7b8a];

  const defaultGroundPoint = (): BeamTarget => ({
    x: viewport.width / 2,
    y: viewport.height * 0.82,
  });

  palette.forEach((color, index) => {
    const width = 120 + Math.random() * 90;
    const length = 540 + Math.random() * 200;
    const beamContainer = createBeamGraphic(color, width, length);
    beamContainer.y = 14;

    const fixture = new Container();
    fixture.sortableChildren = true;
    const housingWidth = 46;
    const housingHeight = 16;
    const housing = new Graphics();
    housing
      .roundRect(-housingWidth / 2, -housingHeight / 2, housingWidth, housingHeight, housingHeight / 2)
      .fill({ color: 0x050505, alpha: 0.95 })
      .stroke({ color: 0x121212, width: 2, alpha: 0.6 });

    const lens = new Graphics();
    lens
      .roundRect(-housingWidth * 0.35, -housingHeight * 0.15, housingWidth * 0.7, housingHeight * 0.55, 4)
      .fill({ color, alpha: 0.35 });
    lens.position.y = housingHeight * 0.15;

    const glowSpot = createGlowSpot(color, randomRange(28, 54));
    spotLayer.addChild(glowSpot);

    fixture.addChild(beamContainer, housing, lens);
    fixtureLayer.addChild(fixture);

    const beam: Beam = {
      container: beamContainer,
      swaySpeed: 0.0006 + Math.random() * 0.0012,
      swayOffset: Math.random() * Math.PI * 2,
      intensity: 0,
      baseLength: length,
      spot: glowSpot,
      anchor: defaultGroundPoint(),
      target: defaultGroundPoint(),
      wanderRadius: randomRange(32, 82),
      anchorTimer: randomRange(900, 1600),
    };

    beams.push(beam);
    fixtures.push({
      container: fixture,
      beam,
      offsetRatio: palette.length <= 1 ? 0 : index / (palette.length - 1) - 0.5,
    });
  });

  const resetBeamAnchors = () => {
    if (penBounds) {
      const bounds = penBounds;
      fixtures.forEach((fixture) => {
        const sample = samplePointInsidePen(bounds);
        fixture.beam.anchor = clonePoint(sample);
        fixture.beam.target = clonePoint(sample);
        fixture.beam.anchorTimer = randomRange(1200, 2400);
      });
      return;
    }
    const fallback = defaultGroundPoint();
    fixtures.forEach((fixture) => {
      fixture.beam.anchor = clonePoint(fallback);
      fixture.beam.target = clonePoint(fallback);
      fixture.beam.anchorTimer = randomRange(900, 1400);
    });
  };

  const drawDimmer = () => {
    dimmer.clear();
    dimmer.rect(0, 0, viewport.width, viewport.height).fill({ color: 0x030014, alpha: 0.78 });
  };

  const drawFloorGlow = () => {
    floorGlow.clear();
    const glowWidth = Math.max(200, viewport.width * 0.6);
    const glowHeight = Math.max(80, viewport.height * 0.08);
    floorGlow
      .ellipse(0, 0, glowWidth / 2, glowHeight)
      .fill({ color: 0x3d114f, alpha: 0.7 });
    floorGlow.position.set(viewport.width / 2, viewport.height * 0.82);
    floorGlow.scale.set(1, 1);
  };

  const drawBar = () => {
    barGraphic.clear();
    barGraphic.removeChildren();
    barGraphic
      .roundRect(-barWidth / 2, -barHeight / 2, barWidth, barHeight, barHeight * 0.45)
      .fill({ color: 0x020202, alpha: 0.96 })
      .stroke({ color: 0x0f1b2f, width: 5, alpha: 0.35 });
    const bolts = new Graphics();
    const boltCount = Math.max(4, Math.floor(barWidth / 120));
    for (let i = 0; i < boltCount; i += 1) {
      const t = i / (boltCount - 1);
      const x = -barWidth / 2 + t * barWidth;
      bolts
        .circle(x, 0, barHeight * 0.12)
        .fill({ color: 0x222439, alpha: 0.8 });
    }
    barGraphic.addChild(bolts);
  };

  const layout = ({ width, height }: { width: number; height: number }) => {
    viewport = { width, height };
    barWidth = Math.max(260, width * 0.62);
    barHeight = Math.max(18, height * 0.02);
    barRestY = height * 0.06;
    barHiddenY = -barHeight * 3;
    drawDimmer();
    drawFloorGlow();
    drawBar();
    const usableWidth = Math.max(100, barWidth - 80);
    fixtures.forEach((fixture) => {
      fixture.container.x = fixture.offsetRatio * usableWidth;
      fixture.container.y = barHeight / 2;
    });
    if (!penBounds) {
      resetBeamAnchors();
    }
  };

  const setPenBounds = (bounds: PenBounds | null) => {
    penBounds = bounds;
    resetBeamAnchors();
  };

  const setEnabled = (value: boolean) => {
    enabled = value;
    targetAlpha = enabled ? 1 : 0;
    barTargetProgress = enabled ? 1 : 0;
    if (!enabled) {
      pulseTarget = 0;
    }
    if (enabled) {
      view.visible = true;
    }
  };

  const setPulseStrength = (strength: number) => {
    pulseTarget = clamp(strength, 0, 1);
  };

  const update = (deltaMS: number) => {
    const alphaEase = Math.min(1, deltaMS / 160);
    currentAlpha += (targetAlpha - currentAlpha) * alphaEase;
    view.alpha = currentAlpha;
    if (!enabled && currentAlpha < 0.01) {
      view.visible = false;
    }

    const dropEase = Math.min(1, deltaMS / 200);
    barProgress += (barTargetProgress - barProgress) * dropEase;
    const clampedBar = clamp(barProgress, 0, 1);
    const barY = barHiddenY + (barRestY - barHiddenY) * clampedBar;
    barContainer.position.set(viewport.width / 2, barY);

    const pulseEase = Math.min(1, deltaMS / 90);
    pulse += (pulseTarget - pulse) * pulseEase;
    const glowGate = clampedBar;
    floorGlow.alpha = (0.25 + pulse * 0.5) * glowGate;
    floorGlow.scale.set(1 + pulse * 0.22, 1 + pulse * 0.32);

    const positionEase = Math.min(1, deltaMS / 220);
    const depthMin = penBounds ? penBounds.footprint.minY : viewport.height * 0.6;
    const depthMax = penBounds ? penBounds.footprint.maxY : viewport.height * 0.92;
    const depthRange = Math.max(1, depthMax - depthMin);

    beams.forEach((beam, index) => {
      beam.swayOffset += beam.swaySpeed * deltaMS;
      beam.anchorTimer -= deltaMS;
      if (beam.anchorTimer <= 0) {
        if (penBounds) {
          beam.anchor = clonePoint(samplePointInsidePen(penBounds));
          beam.anchorTimer = randomRange(1600, 3200);
        } else {
          beam.anchor = clonePoint(defaultGroundPoint());
          beam.anchorTimer = randomRange(900, 1600);
        }
      }

      const offsetX = Math.sin(beam.swayOffset * 1.35 + index) * beam.wanderRadius;
      const offsetY = Math.cos(beam.swayOffset * 0.85 + index * 0.4) * beam.wanderRadius * 0.65;
      const candidate = {
        x: beam.anchor.x + offsetX,
        y: beam.anchor.y + offsetY,
      };
      const grounded = penBounds ? clampPointToPen(candidate, penBounds) : candidate;
      beam.target.x += (grounded.x - beam.target.x) * positionEase;
      beam.target.y += (grounded.y - beam.target.y) * positionEase;

      const intensityTarget = enabled ? 1 : 0;
      const intensityEase = Math.min(1, deltaMS / 220);
      beam.intensity += ((intensityTarget * clampedBar) - beam.intensity) * intensityEase;

      const fixture = fixtures[index];
      const origin = {
        x: barContainer.position.x + fixture.container.x,
        y: barContainer.position.y + fixture.container.y + beam.container.y,
      };
      const dx = beam.target.x - origin.x;
      const dy = beam.target.y - origin.y;
      const distance = Math.max(12, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx) - Math.PI / 2;
      beam.container.rotation = angle;
      beam.container.scale.x = 0.8 + Math.sin(beam.swayOffset * 1.2) * 0.12;
      beam.container.scale.y = distance / beam.baseLength;
      const flicker = 0.7 + Math.sin(beam.swayOffset * 0.5) * 0.2;
      beam.container.alpha = clamp(beam.intensity * flicker, 0, 1);

      const depthRatio = clamp((beam.target.y - depthMin) / depthRange, 0, 1);
      const spotScale = 0.65 + depthRatio * 0.9;
      beam.spot.position.set(beam.target.x, beam.target.y);
      beam.spot.scale.set(spotScale);
      const pulseBoost = 0.35 + pulse * 0.85;
      beam.spot.alpha = clamp(beam.intensity * (0.35 + depthRatio * 0.5) * pulseBoost, 0, 1) * glowGate;
    });
  };

  const destroy = () => {
    view.destroy({ children: true });
    beams.length = 0;
    fixtures.length = 0;
  };

  return {
    view,
    layout,
    setEnabled,
    setPulseStrength,
    setPenBounds,
    update,
    destroy,
  };
};
