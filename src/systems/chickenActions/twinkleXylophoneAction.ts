import { Container, Graphics, Point } from 'pixi.js';
import type { ChickenActionDefinition } from '../chickenActionSystem';
import { CHICKEN_IDLE_POSE } from '../../entities/chicken';
import type { Theme } from '../../config/theme';
import type { BehaviorControlHandle } from './behaviorControl';

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const clamp01 = (value: number) => clamp(value, 0, 1);
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const clamped = clamp01(t);
  return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
};
const easeInCubic = (t: number) => Math.pow(clamp01(t), 3);

type NoteName = 'C4' | 'D4' | 'E4' | 'F4' | 'G4' | 'A4' | 'B4' | 'C5';

const NOTE_FREQUENCY: Record<NoteName, number> = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
};

const BAR_NOTES: NoteName[] = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];

const TWINKLE_TWINKLE: Array<{ note: NoteName; beats: number }> = [
  // Twinkle, twinkle, little star
  { note: 'C4', beats: 1 },
  { note: 'C4', beats: 1 },
  { note: 'G4', beats: 1 },
  { note: 'G4', beats: 1 },
  { note: 'A4', beats: 1 },
  { note: 'A4', beats: 1 },
  { note: 'G4', beats: 2 },
  // How I wonder what you are
  { note: 'F4', beats: 1 },
  { note: 'F4', beats: 1 },
  { note: 'E4', beats: 1 },
  { note: 'E4', beats: 1 },
  { note: 'D4', beats: 1 },
  { note: 'D4', beats: 1 },
  { note: 'C4', beats: 2 },
  // Up above the world so high
  { note: 'G4', beats: 1 },
  { note: 'G4', beats: 1 },
  { note: 'F4', beats: 1 },
  { note: 'F4', beats: 1 },
  { note: 'E4', beats: 1 },
  { note: 'E4', beats: 1 },
  { note: 'D4', beats: 2 },
  // Like a diamond in the sky
  { note: 'G4', beats: 1 },
  { note: 'G4', beats: 1 },
  { note: 'F4', beats: 1 },
  { note: 'F4', beats: 1 },
  { note: 'E4', beats: 1 },
  { note: 'E4', beats: 1 },
  { note: 'D4', beats: 2 },
  // Twinkle, twinkle, little star
  { note: 'C4', beats: 1 },
  { note: 'C4', beats: 1 },
  { note: 'G4', beats: 1 },
  { note: 'G4', beats: 1 },
  { note: 'A4', beats: 1 },
  { note: 'A4', beats: 1 },
  { note: 'G4', beats: 2 },
  // How I wonder what you are
  { note: 'F4', beats: 1 },
  { note: 'F4', beats: 1 },
  { note: 'E4', beats: 1 },
  { note: 'E4', beats: 1 },
  { note: 'D4', beats: 1 },
  { note: 'D4', beats: 1 },
  { note: 'C4', beats: 2 },
];

type NoteEvent = {
  note: NoteName;
  barIndex: number;
  startMS: number;
  durationMS: number;
};

type ToneHandle = {
  stop: () => void;
};

const hasWindow = typeof window !== 'undefined';

type AudioContextConstructor = typeof AudioContext;
type ExtendedWindow = Window & { webkitAudioContext?: AudioContextConstructor };

const getAudioContextConstructor = (): AudioContextConstructor | undefined => {
  if (!hasWindow) {
    return undefined;
  }
  const w = window as ExtendedWindow;
  return globalThis.AudioContext ?? w.webkitAudioContext;
};

const XYLOPHONE_BEAT_MS = 420;
const XYLOPHONE_MASTER_GAIN = 0.36;
const XYLOPHONE_NOTE_VOLUME = 0.74;

let sharedContext: AudioContext | null = null;
let sharedMaster: GainNode | null = null;

const ensureXylophoneBus = () => {
  const AudioCtx = getAudioContextConstructor();
  if (!AudioCtx || !hasWindow) {
    return null;
  }
  if (!sharedContext) {
    sharedContext = new AudioCtx();
    sharedMaster = sharedContext.createGain();
    sharedMaster.gain.value = XYLOPHONE_MASTER_GAIN;
    sharedMaster.connect(sharedContext.destination);
  }
  if (!sharedMaster) {
    sharedMaster = sharedContext.createGain();
    sharedMaster.gain.value = XYLOPHONE_MASTER_GAIN;
    sharedMaster.connect(sharedContext.destination);
  }
  sharedMaster.gain.value = XYLOPHONE_MASTER_GAIN;
  return { ctx: sharedContext, master: sharedMaster };
};

const playXylophoneTone = (options: {
  ctx: AudioContext;
  master: GainNode;
  frequency: number;
  durationSec: number;
  volume: number;
}): ToneHandle => {
  const { ctx, master, frequency, durationSec, volume } = options;
  const now = ctx.currentTime;
  const releasePad = 0.06;

  const preGain = ctx.createGain();
  preGain.gain.setValueAtTime(1, now);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(Math.min(6000, Math.max(320, frequency * 2.4)), now);
  filter.Q.setValueAtTime(1.6, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);

  preGain.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(frequency, now);
  osc.connect(preGain);

  const shimmer = ctx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.setValueAtTime(frequency * 2.01, now);

  const shimmerGain = ctx.createGain();
  shimmerGain.gain.setValueAtTime(0.12, now);
  shimmer.connect(shimmerGain);
  shimmerGain.connect(preGain);

  const attack = 0.004;
  const decay = Math.max(0.08, durationSec);
  const peak = Math.max(0.0001, volume);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

  const stopTime = now + decay + releasePad;
  osc.start(now);
  shimmer.start(now);
  osc.stop(stopTime);
  shimmer.stop(stopTime);

  let stopped = false;
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    const cut = ctx.currentTime + 0.01;
    gain.gain.cancelScheduledValues(cut);
    gain.gain.setValueAtTime(0.0001, cut);
    const safeStop = Math.max(cut + 0.02, stopTime);
    try {
      osc.stop(safeStop);
      shimmer.stop(safeStop);
    } catch {
      // Oscillators may already be stopped; ignore.
    }
    preGain.disconnect();
    filter.disconnect();
    gain.disconnect();
    shimmerGain.disconnect();
    osc.disconnect();
    shimmer.disconnect();
  };

  osc.addEventListener('ended', () => {
    stop();
  });

  return { stop } satisfies ToneHandle;
};

type XylophoneBar = {
  note: NoteName;
  view: Graphics;
  centerX: number;
  hitY: number;
  hit: number;
  baseColor: number;
};

const createXylophoneRig = (options: { theme: Theme; bars: NoteName[] }) => {
  const { theme, bars } = options;
  const view = new Container();
  view.sortableChildren = true;
  view.eventMode = 'none';

  const palette = [
    theme.atmosphere.sunCore,
    theme.grass.accent,
    0x6fd2ff,
    0x9ca9ff,
    0xcf8bff,
    0xff85ec,
    theme.chicken.beakHighlight,
    theme.chicken.comb,
  ];

  const totalHeight = 120;
  const barCount = bars.length;
  const maxBarLength = 78;
  const minBarLength = 46;
  const barHeight = 18;
  const barCorner = 9;
  const barSpacing = 64;
  const sidePadding = 54;
  const totalWidth = sidePadding * 2 + maxBarLength + Math.max(0, barCount - 1) * barSpacing;

  const shadow = new Graphics();
  shadow.zIndex = 0;
  shadow
    .ellipse(totalWidth / 2, totalHeight - 14, totalWidth * 0.34, 10)
    .fill({ color: 0x000000, alpha: 0.14 });

  const legs = new Graphics();
  legs.zIndex = 0.15;
  const legWidth = 22;
  const legHeight = 34;
  const legY = totalHeight - legHeight - 6;
  legs
    .roundRect(sidePadding - 12, legY, legWidth, legHeight, 10)
    .fill({ color: theme.barn.shadow, alpha: 0.6 });
  legs
    .roundRect(totalWidth - sidePadding - legWidth + 12, legY, legWidth, legHeight, 10)
    .fill({ color: theme.barn.shadow, alpha: 0.6 });

  const backRail = new Graphics();
  backRail.zIndex = 0.2;
  const railX0 = sidePadding - 10;
  const railX1 = totalWidth - sidePadding + 10;
  const backRailY0 = 68;
  const backRailY1 = 60;
  const backRailThickness = 12;
  backRail
    .moveTo(railX0, backRailY0)
    .lineTo(railX1, backRailY1)
    .lineTo(railX1, backRailY1 + backRailThickness)
    .lineTo(railX0, backRailY0 + backRailThickness)
    .closePath()
    .fill({ color: theme.barn.roofShadow, alpha: 0.7 })
    .stroke({ color: 0xffffff, alpha: 0.18, width: 3 });

  const frontRail = new Graphics();
  frontRail.zIndex = 0.25;
  const frontRailY0 = 88;
  const frontRailY1 = 80;
  const frontRailThickness = 14;
  frontRail
    .moveTo(railX0 + 6, frontRailY0)
    .lineTo(railX1 - 6, frontRailY1)
    .lineTo(railX1 - 6, frontRailY1 + frontRailThickness)
    .lineTo(railX0 + 6, frontRailY0 + frontRailThickness)
    .closePath()
    .fill({ color: theme.barn.shadow, alpha: 0.66 })
    .stroke({ color: 0xffffff, alpha: 0.16, width: 3 });

  const felt = new Graphics();
  felt.zIndex = 0.4;
  felt
    .moveTo(railX0 + 12, 64)
    .lineTo(railX1 - 12, 56)
    .stroke({ color: theme.atmosphere.cloudShadow, alpha: 0.55, width: 6, cap: 'round' });

  view.addChild(shadow, legs, backRail, frontRail, felt);

  const barViews: XylophoneBar[] = [];

  const startCenterX = sidePadding + maxBarLength / 2;
  const baselineY = 44;

  bars.forEach((note, index) => {
    const t = barCount <= 1 ? 0 : index / (barCount - 1);
    const color = palette[index % palette.length] ?? 0xffffff;
    const bar = new Graphics();
    bar.zIndex = 1 + index * 0.01;

    const barLength = lerp(maxBarLength, minBarLength, t);
    const centerX = startCenterX + index * barSpacing;
    const x = centerX - barLength / 2;
    const y = baselineY + lerp(5, -6, t) + Math.sin(index * 0.65) * 1.2;
    bar.position.set(x, y);

    const shadowOffset = 4;
    bar
      .roundRect(2, shadowOffset, barLength - 4, barHeight, barCorner)
      .fill({ color: 0x000000, alpha: 0.18 })
      .roundRect(0, 0, barLength, barHeight, barCorner)
      .fill({ color, alpha: 0.92 })
      .roundRect(4, 3, barLength - 8, barHeight * 0.45, Math.max(2, barCorner - 2))
      .fill({ color: 0xffffff, alpha: 0.12 })
      .roundRect(4, barHeight * 0.58, barLength - 8, barHeight * 0.28, Math.max(2, barCorner - 2))
      .fill({ color: 0x000000, alpha: 0.06 })
      .stroke({ color: 0xffffff, alpha: 0.25, width: 2 });

    const holeY = barHeight / 2;
    const holeInset = Math.min(16, barLength * 0.28);
    const holeRadius = 3.6;
    bar.circle(holeInset, holeY, holeRadius).fill({ color: theme.barn.roofShadow, alpha: 0.35 });
    bar.circle(barLength - holeInset, holeY, holeRadius).fill({ color: theme.barn.roofShadow, alpha: 0.35 });

    bar
      .circle(holeInset, holeY, holeRadius + 1.8)
      .stroke({ color: 0xffffff, alpha: 0.32, width: 1.8 });
    bar
      .circle(barLength - holeInset, holeY, holeRadius + 1.8)
      .stroke({ color: 0xffffff, alpha: 0.32, width: 1.8 });

    view.addChild(bar);
    barViews.push({
      note,
      view: bar,
      centerX,
      hitY: y + barHeight / 2,
      hit: 0,
      baseColor: color,
    });
  });

  view.pivot.set(totalWidth / 2, totalHeight / 2);

  return {
    view,
    bars: barViews,
    size: { width: totalWidth, height: totalHeight },
  };
};

type ChickenMallet = {
  view: Container;
  destroy: () => void;
};

const createChickenMallet = (theme: Theme): ChickenMallet => {
  const view = new Container();
  view.sortableChildren = true;
  view.eventMode = 'none';

  const handle = new Graphics();
  handle
    .roundRect(0, -4, 78, 8, 4)
    .fill({ color: theme.barn.roof, alpha: 0.8 })
    .stroke({ color: 0xffffff, alpha: 0.22, width: 2 });

  const head = new Graphics();
  head
    .roundRect(70, -18, 28, 36, 12)
    .fill({ color: theme.atmosphere.cloudLight, alpha: 0.97 })
    .stroke({ color: theme.chicken.outline, alpha: 0.22, width: 2.2 });

  const blush = new Graphics();
  blush.ellipse(84, -2, 8, 10).fill({ color: theme.chicken.comb, alpha: 0.18 });

  view.addChild(handle, head, blush);
  view.pivot.set(6, 0);

  return {
    view,
    destroy: () => view.destroy({ children: true }),
  } satisfies ChickenMallet;
};

type Sparkle = {
  sprite: Graphics;
  life: number;
  ttl: number;
  velocity: { x: number; y: number };
  spin: number;
};

const createStarSparkle = (color: number) => {
  const g = new Graphics();
  g.zIndex = 9;
  const r = 8;
  const points = 5;
  for (let i = 0; i < points * 2; i += 1) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      g.moveTo(x, y);
    } else {
      g.lineTo(x, y);
    }
  }
  g.closePath();
  g.fill({ color, alpha: 0.9 });
  g.stroke({ color: 0xffffff, alpha: 0.35, width: 2 });
  return g;
};

export const createTwinkleXylophoneAction = (): ChickenActionDefinition => ({
  id: 'twinkle-xylophone',
  weight: 1.05,
  create: (context) => {
    const { chicken, environmentScene, theme, behaviorControls, depthSystem, penBoundsService, layerService } = context;

    const penLayer = environmentScene.penLayer;
    const particlesParent = layerService.getLayer('particles') ?? penLayer;

    const tipLocalPoint = new Point(chicken.metrics.beak.length + 8, -2);
    const sharedPointA = new Point();
    const sharedPointB = new Point();
    const malletWingPivot = new Point();
    const malletWingAxis = new Point();
    const malletGlobalPivot = new Point();
    const malletGlobalAxis = new Point();
    const malletChickenPivot = new Point();
    const malletChickenAxis = new Point();

    const getBeakTipPosition = () => {
      const global = chicken.parts.beak.toGlobal(tipLocalPoint, sharedPointA);
      const local = penLayer.toLocal(global, undefined, sharedPointB);
      return { x: local.x, y: local.y };
    };

    const basePosition = { x: chicken.view.position.x, y: chicken.view.position.y };
    const baseFacing = chicken.getFacing();
    const baseScale = Math.abs(chicken.view.scale.y);
    const instrumentBaseScale = baseScale * 0.9;

    const beatMS = XYLOPHONE_BEAT_MS;
    const introMS = 650;
    const outroMS = 950;
    const songStartMS = 520;

    const events: NoteEvent[] = [];
    let cursor = songStartMS;
    for (const step of TWINKLE_TWINKLE) {
      const durationMS = step.beats * beatMS;
      const barIndex = Math.max(0, BAR_NOTES.indexOf(step.note));
      events.push({
        note: step.note,
        barIndex,
        startMS: cursor,
        durationMS,
      });
      cursor += durationMS;
    }

    const songEndMS = cursor;
    const actionDurationMS = songEndMS + outroMS;

    const xylophoneRig = createXylophoneRig({ theme, bars: BAR_NOTES });
    xylophoneRig.view.scale.set(instrumentBaseScale);
    xylophoneRig.view.alpha = 0;
    xylophoneRig.view.rotation = 0;

    const sparkleLayer = new Container();
    sparkleLayer.sortableChildren = true;
    sparkleLayer.eventMode = 'none';
    sparkleLayer.zIndex = 100;
    particlesParent.addChild(sparkleLayer);

    const sparkles: Sparkle[] = [];

    let mallet: ChickenMallet | null = null;
    const malletBase = { x: 56, y: 8 };
    const malletIdleRotation = -0.55;
    const malletHitLocalPoint = new Point(84, 0);

    let behaviorHandle: BehaviorControlHandle | null = null;
    let controlReleased = false;
    let tones: ToneHandle[] = [];
    let audioBus: { ctx: AudioContext; master: GainNode } | null = null;

    let nextNoteIndex = 0;
    let lastBarIndex: number | null = null;
    let strike: { barIndex: number; startMS: number; durationMS: number } | null = null;

    let instrumentX = basePosition.x;
    let instrumentY = basePosition.y;
    let stridePhase = Math.random() * Math.PI * 2;

    const releaseControl = () => {
      if (controlReleased) {
        return;
      }
      controlReleased = true;
      behaviorHandle?.release();
      behaviorHandle = null;
      chicken.view.position.set(basePosition.x, basePosition.y);
      chicken.setFacing(baseFacing);
      chicken.resetPose();
    };

    const cleanupMallet = () => {
      if (!mallet) {
        return;
      }
      mallet.view.parent?.removeChild(mallet.view);
      mallet.destroy();
      mallet = null;
    };

    const cleanupVisuals = () => {
      depthSystem.unregister(xylophoneRig.view);
      xylophoneRig.view.parent?.removeChild(xylophoneRig.view);
      xylophoneRig.view.destroy({ children: true });

      sparkles.splice(0).forEach((sparkle) => {
        sparkle.sprite.parent?.removeChild(sparkle.sprite);
        sparkle.sprite.destroy();
      });
      sparkleLayer.parent?.removeChild(sparkleLayer);
      sparkleLayer.destroy({ children: true });
    };

    const stopAllTones = () => {
      tones.forEach((tone) => tone.stop());
      tones = [];
    };

    const safeCleanup = () => {
      stopAllTones();
      cleanupVisuals();
      cleanupMallet();
      releaseControl();
    };

    const getBarWorldPosition = (barIndex: number) => {
      const bar = xylophoneRig.bars[barIndex] ?? xylophoneRig.bars[0];
      if (!bar) {
        return { x: xylophoneRig.view.position.x, y: xylophoneRig.view.position.y };
      }
      const sx = xylophoneRig.view.scale.x;
      const sy = xylophoneRig.view.scale.y;
      return {
        x: xylophoneRig.view.position.x + (bar.centerX - xylophoneRig.view.pivot.x) * sx,
        y: xylophoneRig.view.position.y + (bar.hitY - xylophoneRig.view.pivot.y) * sy,
      };
    };

    const spawnSparkle = (barIndex: number) => {
      const bar = xylophoneRig.bars[barIndex];
      if (!bar) {
        return;
      }
      const color = bar.baseColor;
      const sprite = createStarSparkle(color);
      const pos = getBarWorldPosition(barIndex);
      sprite.position.set(pos.x, pos.y);
      sprite.scale.set(baseScale * 0.6);
      sparkleLayer.addChild(sprite);
      sparkles.push({
        sprite,
        life: 0,
        ttl: 950 + Math.random() * 300,
        velocity: {
          x: (Math.random() - 0.5) * 0.14,
          y: -0.22 - Math.random() * 0.12,
        },
        spin: (Math.random() - 0.5) * 0.01,
      });
    };

    const triggerBarHit = (barIndex: number) => {
      const bar = xylophoneRig.bars[barIndex];
      if (!bar) {
        return;
      }
      bar.hit = 1;
      spawnSparkle(barIndex);
    };

    const playNote = (note: NoteName, durationMS: number) => {
      if (!audioBus) {
        audioBus = ensureXylophoneBus();
        void audioBus?.ctx.resume();
      }
      if (!audioBus) {
        return;
      }
      const frequency = NOTE_FREQUENCY[note];
      if (!frequency) {
        return;
      }
      const durationSec = Math.max(0.08, durationMS / 1000);
      const tone = playXylophoneTone({
        ctx: audioBus.ctx,
        master: audioBus.master,
        frequency,
        durationSec,
        volume: XYLOPHONE_NOTE_VOLUME,
      });
      tones.push(tone);
    };

    const beginStrike = (barIndex: number, elapsedMS: number, noteDurationMS: number) => {
      strike = {
        barIndex,
        startMS: elapsedMS,
        durationMS: Math.min(240, Math.max(140, noteDurationMS * 0.55)),
      };
    };

    const getStrikeAmount = (elapsedMS: number) => {
      if (!strike) {
        return 0;
      }
      const t = clamp01((elapsedMS - strike.startMS) / Math.max(1, strike.durationMS));
      const amount = Math.sin(t * Math.PI);
      if (t >= 1) {
        strike = null;
      }
      return amount;
    };

    const updateMallet = (elapsedMS: number, strikeAmount: number) => {
      if (!mallet) {
        return;
      }
      const idleWiggle = Math.sin(elapsedMS / 260) * 0.05;
      const wing = chicken.parts.wing;
      const x = malletBase.x + strikeAmount * 2;
      const y = malletBase.y + strikeAmount * 10 + Math.sin(elapsedMS / 520) * 1.2;
      const rotation = malletIdleRotation + idleWiggle + strikeAmount * 1.05;

      const axisDistance = 24;
      malletWingPivot.set(x, y);
      malletWingAxis.set(x + Math.cos(rotation) * axisDistance, y + Math.sin(rotation) * axisDistance);

      wing.toGlobal(malletWingPivot, malletGlobalPivot);
      wing.toGlobal(malletWingAxis, malletGlobalAxis);
      chicken.view.toLocal(malletGlobalPivot, undefined, malletChickenPivot);
      chicken.view.toLocal(malletGlobalAxis, undefined, malletChickenAxis);

      mallet.view.position.set(malletChickenPivot.x, malletChickenPivot.y);
      mallet.view.rotation = Math.atan2(
        malletChickenAxis.y - malletChickenPivot.y,
        malletChickenAxis.x - malletChickenPivot.x,
      );
    };

    const updateChickenMovement = (deltaMS: number, elapsedMS: number) => {
      const lookAheadMS = 260;
      const upcoming = events[nextNoteIndex];
      const targetBarIndex = strike?.barIndex ??
        (upcoming && elapsedMS + lookAheadMS >= upcoming.startMS
          ? upcoming.barIndex
          : lastBarIndex ?? upcoming?.barIndex ?? 0);

      const target = getBarWorldPosition(targetBarIndex);
      const striker = mallet
        ? (() => {
            const global = mallet.view.toGlobal(malletHitLocalPoint, sharedPointA);
            const local = penLayer.toLocal(global, undefined, sharedPointB);
            return { x: local.x, y: local.y };
          })()
        : getBeakTipPosition();
      const dx = target.x - striker.x;

      const moveSpeed = 320;
      const step = (moveSpeed * deltaMS) / 1000;
      const moveX = clamp(dx, -step, step);
      chicken.view.position.x += moveX;

      const bounds = penBoundsService.getBounds();
      if (bounds) {
        const margin = Math.max(8, 40 * baseScale);
        chicken.view.position.x = clamp(
          chicken.view.position.x,
          bounds.footprint.minX + margin,
          bounds.footprint.maxX - margin,
        );
      }

      const movementIntensity = step > 0 ? clamp01(Math.abs(moveX) / step) : 0;
      if (movementIntensity > 0.02) {
        stridePhase += (deltaMS / 1000) * (7.2 + movementIntensity * 5);
      } else {
        stridePhase += (deltaMS / 1000) * 1.2;
      }

      return { targetBarIndex, movementIntensity };
    };

    const updateChickenPose = (elapsedMS: number, movementIntensity: number, strikeAmount: number) => {
      const groovePhase = (elapsedMS - songStartMS) / beatMS;
      const groove = Math.sin(groovePhase * Math.PI * 2);
      const grooveSoft = Math.sin(groovePhase * Math.PI);

      const strideWave = Math.sin(stridePhase);
      const hopWave = Math.max(0, Math.sin(stridePhase * 2));
      const stride = strideWave * movementIntensity * 0.7;
      const stepLift = hopWave * movementIntensity * 10;

      chicken.setPose({
        bodyLean: (CHICKEN_IDLE_POSE.bodyLean ?? 0) - 0.06 + strikeAmount * 0.22 + movementIntensity * 0.08,
        bodyLift: (CHICKEN_IDLE_POSE.bodyLift ?? 0) - 5 + grooveSoft * 2 + stepLift * 0.25 + strikeAmount * 8,
        headPitch: (CHICKEN_IDLE_POSE.headPitch ?? 0) + 0.14 + groove * 0.06 + strikeAmount * 0.35,
        headBob: (CHICKEN_IDLE_POSE.headBob ?? 0) - 6 + groove * 2 + stepLift * 0.2 + strikeAmount * 12,
        headForward: grooveSoft * 6 + strikeAmount * 14,
        beakOpen: (CHICKEN_IDLE_POSE.beakOpen ?? 0.05) + Math.max(0, groove) * 0.05 + strikeAmount * 0.16,
        wingLift: groove * 4 + strikeAmount * 18,
        wingPitch: groove * 0.08 + strikeAmount * 0.55,
        tailLift: (CHICKEN_IDLE_POSE.tailLift ?? 0) + groove * 0.05 - strikeAmount * 0.06,
        tailSplay: (CHICKEN_IDLE_POSE.tailSplay ?? 0.4) + Math.max(0, groove) * 0.04,
        stride,
        frontFootLift: stepLift + strikeAmount * 4,
        backFootLift: stepLift * 0.8 + strikeAmount * 3,
      });
    };

    const updateBars = (deltaMS: number, elapsedMS: number) => {
      const decay = deltaMS / 260;
      xylophoneRig.bars.forEach((bar, index) => {
        bar.hit = Math.max(0, bar.hit - decay);
        const bounce = Math.sin((1 - bar.hit) * Math.PI);
        const pop = bar.hit > 0 ? 0.18 * bounce : 0;
        const wobble = Math.sin((index + 1) * 0.7 + elapsedMS / 220) * 0.02;
        bar.view.scale.set(1 + bar.hit * 0.12, 1 + pop);
        bar.view.rotation = wobble * bar.hit;
        bar.view.alpha = 0.9 + bar.hit * 0.1;
      });
    };

    const updateSparkles = (deltaMS: number) => {
      for (let i = sparkles.length - 1; i >= 0; i -= 1) {
        const sparkle = sparkles[i];
        sparkle.life += deltaMS;
        const t = clamp01(sparkle.life / sparkle.ttl);
        sparkle.sprite.position.x += sparkle.velocity.x * deltaMS;
        sparkle.sprite.position.y += sparkle.velocity.y * deltaMS;
        sparkle.velocity.y += 0.00018 * deltaMS;
        sparkle.sprite.rotation += sparkle.spin * deltaMS;
        sparkle.sprite.alpha = 1 - t;
        sparkle.sprite.scale.set(baseScale * lerp(0.7, 1.2, Math.sin(t * Math.PI)));
        if (t >= 1) {
          sparkle.sprite.parent?.removeChild(sparkle.sprite);
          sparkle.sprite.destroy();
          sparkles.splice(i, 1);
        }
      }
    };

    const updateInstrument = (elapsedMS: number) => {
      const fadeIn = clamp01(elapsedMS / introMS);
      const fadeOut =
        elapsedMS < actionDurationMS - outroMS
          ? 1
          : 1 - clamp01((elapsedMS - (actionDurationMS - outroMS)) / outroMS);
      xylophoneRig.view.alpha = fadeIn * fadeOut;
    };

    return {
      durationMS: actionDurationMS,
      onEnter: () => {
        controlReleased = false;
        tones = [];
        audioBus = null;
        nextNoteIndex = 0;
        lastBarIndex = null;
        strike = null;

        behaviorHandle = behaviorControls.takeover({
          animatorAuthority: 'external',
          stateLock: 'idle',
          speedMultiplier: 0,
        });

        // Unlock WebAudio in the user gesture that triggered the action (autoplay policies).
        audioBus = ensureXylophoneBus();
        void audioBus?.ctx.resume();

        chicken.view.position.set(basePosition.x, basePosition.y);
        chicken.setFacing(baseFacing);
        chicken.resetPose();

        cleanupMallet();
        mallet = createChickenMallet(theme);
        mallet.view.zIndex = 2.8;
        chicken.view.addChild(mallet.view);
        updateMallet(0, 0);

        const bounds = penBoundsService.getBounds();
        const groundY = basePosition.y + chicken.metrics.feet.groundY * baseScale;
        const halfWidth = (xylophoneRig.size.width / 2) * instrumentBaseScale;
        const halfHeight = (xylophoneRig.size.height / 2) * instrumentBaseScale;

        instrumentX = basePosition.x;
        if (bounds) {
          const edgePad = Math.max(10, 18 * baseScale);
          instrumentX = clamp(
            instrumentX,
            bounds.footprint.minX + halfWidth + edgePad,
            bounds.footprint.maxX - halfWidth - edgePad,
          );
        }

        const bottomY = groundY + Math.max(6, 10 * baseScale);
        instrumentY = bottomY - halfHeight;

        xylophoneRig.view.position.set(instrumentX, instrumentY);
        xylophoneRig.view.alpha = 0;
        penLayer.addChild(xylophoneRig.view);
        depthSystem.register({
          target: xylophoneRig.view,
          layer: 1,
          getDepth: () =>
            xylophoneRig.view.position.y + (xylophoneRig.size.height / 2) * xylophoneRig.view.scale.y,
          bias: 0.05,
        });
      },
      onUpdate: (deltaMS, elapsedMS) => {
        updateInstrument(elapsedMS);

        while (nextNoteIndex < events.length && elapsedMS >= events[nextNoteIndex].startMS) {
          const event = events[nextNoteIndex];
          if (event) {
            triggerBarHit(event.barIndex);
            beginStrike(event.barIndex, elapsedMS, event.durationMS);
            playNote(event.note, event.durationMS);
            lastBarIndex = event.barIndex;
          }
          nextNoteIndex += 1;
        }

        const strikeAmount = getStrikeAmount(elapsedMS);
        const { movementIntensity } = updateChickenMovement(deltaMS, elapsedMS);
        updateChickenPose(elapsedMS, movementIntensity, strikeAmount);
        updateMallet(elapsedMS, strikeAmount);
        updateBars(deltaMS, elapsedMS);
        updateSparkles(deltaMS);
      },
      onExit: () => {
        safeCleanup();
      },
    };
  },
});
