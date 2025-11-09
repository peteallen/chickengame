import { Container, Graphics } from 'pixi.js';

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

export type DiscoRig = {
  view: Container;
  layout: (size: { width: number; height: number }) => void;
  setEnabled: (enabled: boolean) => void;
  setPulseStrength: (strength: number) => void;
  update: (deltaMS: number) => void;
  destroy: () => void;
};

type Beam = {
  container: Container;
  swaySpeed: number;
  swayOffset: number;
  rotationAmplitude: number;
  intensity: number;
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

  const barContainer = new Container();
  barContainer.zIndex = 1;
  const barGraphic = new Graphics();
  const fixtureLayer = new Container();
  fixtureLayer.sortableChildren = true;
  barContainer.addChild(barGraphic, fixtureLayer);

  view.addChild(dimmer, floorGlow, barContainer);

  let viewport = { width: 0, height: 0 };
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

    fixture.addChild(beamContainer, housing, lens);
    fixtureLayer.addChild(fixture);

    const beam: Beam = {
      container: beamContainer,
      swaySpeed: 0.0006 + Math.random() * 0.0012,
      swayOffset: Math.random() * Math.PI * 2,
      rotationAmplitude: 0.25 + Math.random() * 0.35,
      intensity: 0,
    };

    beams.push(beam);
    fixtures.push({
      container: fixture,
      beam,
      offsetRatio: palette.length <= 1 ? 0 : index / (palette.length - 1) - 0.5,
    });
  });

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

    beams.forEach((beam, index) => {
      beam.swayOffset += beam.swaySpeed * deltaMS;
      const wobble = Math.sin(beam.swayOffset + index);
      const intensityTarget = enabled ? 1 : 0;
      const intensityEase = Math.min(1, deltaMS / 220);
      beam.intensity += ((intensityTarget * clampedBar) - beam.intensity) * intensityEase;
      const stretch = 0.6 + clampedBar * 1.0;
      beam.container.scale.set(0.8 + Math.sin(beam.swayOffset * 1.3) * 0.12, stretch);
      beam.container.rotation = wobble * beam.rotationAmplitude;
      beam.container.alpha = clamp(beam.intensity * (0.7 + Math.sin(beam.swayOffset * 0.5) * 0.2), 0, 1);
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
    update,
    destroy,
  };
};
