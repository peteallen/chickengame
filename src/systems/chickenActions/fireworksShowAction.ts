import { Container, Graphics } from 'pixi.js';
import type { ChickenActionDefinition } from '../chickenActionSystem';
import type { BehaviorControlHandle } from './behaviorControl';
import type { PenBounds } from '../../lib/geometry/penBounds';

const FIREWORK_COUNT = 5;
const IGNITE_INTERVAL_MS = 600;
const FUSE_DURATION_MS = 500;
const LAUNCH_DURATION_MS = 1200;
const EXPLOSION_DURATION_MS = 1900;
const NIGHT_FADE_MS = 600;
const END_HOLD_MS = 900;
const OVERLAY_ALPHA = 0.68;
const TRAIL_INTERVAL_MS = 60;
const PEAK_HEIGHT_RANGE = { min: 320, max: 480 } as const;
const EXPLOSION_PARTICLE_COUNT = 48;
const GLITTER_PARTICLE_COUNT = 36;
const EXTRA_EXPLOSION_COLORS = [
  0xff85ec,
  0xfff57a,
  0x7df9ff,
  0xff9966,
  0xb1ff9b,
  0x9ca9ff,
  0xffd1dc,
];

const ACTION_DURATION_MS =
  NIGHT_FADE_MS +
  (FIREWORK_COUNT - 1) * IGNITE_INTERVAL_MS +
  FUSE_DURATION_MS +
  LAUNCH_DURATION_MS +
  EXPLOSION_DURATION_MS +
  END_HOLD_MS +
  NIGHT_FADE_MS;

type Vec2 = { x: number; y: number };

type SparkParticle = {
  sprite: Graphics;
  life: number;
  ttl: number;
  velocity: Vec2;
  gravity: number;
  spin: number;
  startScale: number;
  baseAlpha: number;
};

type FireworkRocket = {
  container: Container;
  base: Vec2;
  peak: Vec2;
  color: number;
  fuseGlow: Graphics;
  flame: Graphics;
  igniteDelay: number;
  hasExploded: boolean;
  trailTimer: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const randRange = (min: number, max: number) => min + Math.random() * (max - min);

const createNightOverlay = () => {
  const overlay = new Graphics();
  overlay.zIndex = 0;
  const width = window.innerWidth || 1920;
  const height = window.innerHeight || 1080;
  overlay
    .rect(0, 0, width, height)
    .fill({ color: 0x020615, alpha: 1 });
  overlay.alpha = 0;
  return overlay;
};

const samplePenPoint = (bounds: PenBounds | null, key: keyof PenBounds['polygon'], fallback: Vec2): Vec2 => {
  if (!bounds) {
    return fallback;
  }
  const point = bounds.polygon[key];
  return { x: point.x, y: point.y };
};

const createRocket = (options: {
  base: Vec2;
  peak: Vec2;
  color: number;
  igniteDelay: number;
}): FireworkRocket => {
  const { base, peak, color, igniteDelay } = options;
  const container = new Container();
  container.position.set(base.x, base.y);
  container.zIndex = 2;

  const body = new Graphics();
  body
    .roundRect(-6, -36, 12, 32, 4)
    .fill({ color, alpha: 0.95 })
    .stroke({ color: 0xffffff, alpha: 0.45, width: 1.4 });

  const stripes = new Graphics();
  stripes
    .rect(-6, -30, 12, 4)
    .rect(-6, -18, 12, 4)
    .fill({ color: 0xffffff, alpha: 0.35 });

  const fins = new Graphics();
  fins
    .moveTo(-6, -4)
    .lineTo(-18, 2)
    .lineTo(-6, 6)
    .moveTo(6, -4)
    .lineTo(18, 2)
    .lineTo(6, 6)
    .fill({ color, alpha: 0.8 })
    .stroke({ color: 0xffffff, alpha: 0.25, width: 1 });

  const nose = new Graphics();
  nose
    .moveTo(0, -48)
    .lineTo(9, -36)
    .lineTo(-9, -36)
    .closePath()
    .fill({ color: 0xffffff, alpha: 0.95 });

  const fuseGlow = new Graphics();
  fuseGlow
    .circle(0, 8, 4)
    .fill({ color: 0xffb347, alpha: 1 });
  fuseGlow.pivot.set(0, 0);
  fuseGlow.blendMode = 'add';

  const flame = new Graphics();
  flame
    .moveTo(0, 8)
    .quadraticCurveTo(-3, 20, 0, 28)
    .quadraticCurveTo(3, 20, 0, 8)
    .fill({ color: 0xfff1c7, alpha: 0.95 })
    .stroke({ color: 0xff6f7c, alpha: 0.5, width: 1 });
  flame.blendMode = 'add';
  flame.visible = false;

  container.addChild(fins, body, stripes, nose, fuseGlow, flame);

  return {
    container,
    base,
    peak,
    color,
    fuseGlow,
    flame,
    igniteDelay,
    hasExploded: false,
    trailTimer: 0,
  } satisfies FireworkRocket;
};

const createSparkLayer = () => {
  const sparkLayer = new Container();
  sparkLayer.zIndex = 4;
  sparkLayer.blendMode = 'add';
  return sparkLayer;
};

const spawnSparkParticle = (
  layer: Container,
  particles: SparkParticle[],
  position: Vec2,
  options: {
    color: number;
    radius?: number;
    ttl?: number;
    velocity?: Vec2;
    gravity?: number;
    spin?: number;
    startScale?: number;
    alpha?: number;
  },
) => {
  const sprite = new Graphics();
  const radius = options.radius ?? 2;
  const alpha = options.alpha ?? 1;
  sprite.circle(0, 0, radius).fill({ color: options.color, alpha: 1 });
  sprite.position.set(position.x, position.y);
  sprite.blendMode = 'add';
  sprite.alpha = alpha;
  layer.addChild(sprite);
  particles.push({
    sprite,
    life: 0,
    ttl: options.ttl ?? 900,
    velocity: { x: options.velocity?.x ?? 0, y: options.velocity?.y ?? 0 },
    gravity: options.gravity ?? 0,
    spin: options.spin ?? 0,
    startScale: options.startScale ?? 1,
    baseAlpha: alpha,
  });
};

const spawnExplosion = (
  layer: Container,
  particles: SparkParticle[],
  position: Vec2,
  palette: number[],
) => {
  const colorPool = [...palette, ...EXTRA_EXPLOSION_COLORS];
  for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i += 1) {
    const angle = (i / EXPLOSION_PARTICLE_COUNT) * Math.PI * 2 + randRange(-0.12, 0.12);
    const speed = randRange(190, 360);
    const color = colorPool[Math.floor(Math.random() * colorPool.length)];
    spawnSparkParticle(layer, particles, position, {
      color,
      radius: randRange(1.2, 3.4),
      ttl: randRange(1200, 1900),
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      },
      gravity: randRange(80, 160),
      spin: randRange(-5, 5),
      startScale: randRange(0.8, 1.6),
    });
  }

  for (let i = 0; i < GLITTER_PARTICLE_COUNT; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = randRange(12, 48);
    spawnSparkParticle(
      layer,
      particles,
      {
        x: position.x + Math.cos(angle) * distance,
        y: position.y + Math.sin(angle) * distance,
      },
      {
        color: colorPool[Math.floor(Math.random() * colorPool.length)],
        radius: randRange(0.6, 1.4),
        ttl: randRange(420, 720),
        gravity: 40,
        velocity: {
          x: randRange(-40, 40),
          y: randRange(-40, 10),
        },
        alpha: 0.9,
        startScale: 0.7,
      },
    );
  }

  for (let i = 0; i < GLITTER_PARTICLE_COUNT / 2; i += 1) {
    spawnSparkParticle(layer, particles, position, {
      color: palette[i % palette.length],
      radius: randRange(0.8, 1.6),
      ttl: randRange(900, 1400),
      velocity: {
        x: randRange(-60, 60),
        y: randRange(40, 120),
      },
      gravity: 140,
      alpha: 0.85,
      startScale: 0.9,
    });
  }

  spawnSparkParticle(layer, particles, position, {
    color: 0xffffff,
    radius: 12,
    ttl: 620,
    startScale: 1.3,
    alpha: 0.95,
  });

  spawnSparkParticle(layer, particles, position, {
    color: 0xfff0d0,
    radius: 18,
    ttl: 720,
    startScale: 0.9,
    alpha: 0.55,
  });

  spawnSparkParticle(layer, particles, position, {
    color: 0xfff8f0,
    radius: 22,
    ttl: 780,
    startScale: 1.4,
    alpha: 0.6,
  });
};

const spawnTrailSpark = (
  layer: Container,
  particles: SparkParticle[],
  position: Vec2,
  color: number,
) => {
  spawnSparkParticle(layer, particles, position, {
    color,
    radius: randRange(0.9, 1.6),
    ttl: randRange(340, 540),
    velocity: {
      x: randRange(-24, 24),
      y: randRange(10, 50),
    },
    gravity: 70,
    alpha: 0.95,
    startScale: 0.85,
  });
};

const spawnFuseSpark = (
  layer: Container,
  particles: SparkParticle[],
  position: Vec2,
) => {
  spawnSparkParticle(layer, particles, position, {
    color: 0xffc857,
    radius: randRange(0.9, 1.3),
    ttl: randRange(220, 320),
    velocity: {
      x: randRange(-30, 30),
      y: randRange(-10, 10),
    },
    gravity: 40,
    alpha: 0.8,
  });
};

const updateSparkles = (particles: SparkParticle[], deltaMS: number) => {
  const deltaSeconds = deltaMS / 1000;
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life += deltaMS;
    if (particle.life >= particle.ttl) {
      particle.sprite.destroy();
      particles.splice(i, 1);
      continue;
    }
    const progress = particle.life / particle.ttl;
    particle.velocity.y += particle.gravity * deltaSeconds;
    particle.sprite.x += particle.velocity.x * deltaSeconds;
    particle.sprite.y += particle.velocity.y * deltaSeconds;
    particle.sprite.rotation += particle.spin * deltaSeconds;
    const scale = particle.startScale * (1 + progress * 0.65);
    particle.sprite.scale.set(scale, scale);
    particle.sprite.alpha = particle.baseAlpha * (1 - progress);
  }
};

const computeBasePositions = (bounds: PenBounds | null, count: number): Vec2[] => {
  const fallbackLeft: Vec2 = { x: 280, y: 420 };
  const fallbackRight: Vec2 = { x: 520, y: 420 };
  const frontLeft = samplePenPoint(bounds, 'frontLeft', fallbackLeft);
  const frontRight = samplePenPoint(bounds, 'frontRight', fallbackRight);
  const backLeft = samplePenPoint(bounds, 'backLeft', { x: frontLeft.x - 40, y: frontLeft.y - 80 });

  const inward = {
    x: (backLeft.x - frontLeft.x) * 0.12,
    y: (backLeft.y - frontLeft.y) * 0.12,
  };

  const results: Vec2[] = [];
  const steps = Math.max(1, count - 1);
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0.5 : i / steps;
    results.push({
      x: lerp(frontLeft.x, frontRight.x, t) + inward.x,
      y: lerp(frontLeft.y, frontRight.y, t) + inward.y - 6,
    });
  }
  return results;
};

const computePeaks = (bases: Vec2[]): Vec2[] =>
  bases.map((base) => ({
    x: base.x + randRange(-90, 90),
    y: base.y - randRange(PEAK_HEIGHT_RANGE.min, PEAK_HEIGHT_RANGE.max),
  }));

export const createFireworksShowAction = (): ChickenActionDefinition => ({
  id: 'fireworks-show',
  weight: 0.9,
  create: (context) => {
    const { environmentScene, theme, layers, behaviorControls } = context;
    const overlayLayer = layers.overlay;
    const fireworksLayer = new Container();
    fireworksLayer.sortableChildren = true;
    fireworksLayer.zIndex = 1;

    const sparkLayer = createSparkLayer();
    const rocketLayer = new Container();
    rocketLayer.zIndex = 2;
    rocketLayer.sortableChildren = true;

    fireworksLayer.addChild(rocketLayer, sparkLayer);

    const nightOverlay = createNightOverlay();
    overlayLayer.addChild(nightOverlay, fireworksLayer);

    const palette = [
      theme.chicken.comb,
      theme.chicken.wattle,
      theme.chicken.beakHighlight,
      theme.chick.bodyPrimary,
      0x66d2ff,
      0xb47bff,
    ];

    const bases = computeBasePositions(environmentScene.getPenBounds(), FIREWORK_COUNT);
    const peaks = computePeaks(bases);

    const launchRail = new Graphics();
    launchRail.zIndex = 0;
    launchRail
      .moveTo(bases[0]?.x ?? 0, bases[0]?.y ?? 0)
      .lineTo(bases[bases.length - 1]?.x ?? 0, bases[bases.length - 1]?.y ?? 0)
      .stroke({ color: 0x2a303d, width: 4, alpha: 0.4 });
    rocketLayer.addChild(launchRail);

    const rockets = bases.map((base, index) =>
      createRocket({
        base,
        peak: peaks[index],
        color: palette[index % palette.length],
        igniteDelay: index * IGNITE_INTERVAL_MS,
      }),
    );
    rockets.forEach((rocket) => rocketLayer.addChild(rocket.container));

    const sparkles: SparkParticle[] = [];
    let behaviorHandle: BehaviorControlHandle | null = null;
    const previousSkyMode = environmentScene.getSkyMode();
    let skyModeActive = false;

    const cleanup = () => {
      rockets.forEach((rocket) => rocket.container.destroy({ children: true }));
      sparkles.forEach((sparkle) => sparkle.sprite.destroy());
      sparkles.length = 0;
      launchRail.destroy();
      fireworksLayer.parent?.removeChild(fireworksLayer);
      fireworksLayer.destroy({ children: true });
      nightOverlay.parent?.removeChild(nightOverlay);
      nightOverlay.destroy();
      behaviorHandle?.release();
      behaviorHandle = null;
      if (skyModeActive) {
        environmentScene.setSkyMode(previousSkyMode);
        skyModeActive = false;
      }
    };

    return {
      durationMS: ACTION_DURATION_MS,
      onEnter: () => {
        behaviorHandle = behaviorControls.takeover({
          stateLock: 'idle',
          speedMultiplier: 0,
          animatorAuthority: 'external',
          followerEnabled: false,
        });
        environmentScene.setSkyMode('night');
        skyModeActive = true;
      },
      onUpdate: (deltaMS, elapsedMS) => {
        const fadeInStrength = clamp01(elapsedMS / NIGHT_FADE_MS);
        const fadeOutStart = ACTION_DURATION_MS - NIGHT_FADE_MS;
        const fadeOutStrength = elapsedMS <= fadeOutStart
          ? 1
          : 1 - clamp01((elapsedMS - fadeOutStart) / NIGHT_FADE_MS);
        nightOverlay.alpha = OVERLAY_ALPHA * Math.min(fadeInStrength, fadeOutStrength);

        rockets.forEach((rocket) => {
          const relativeTime = elapsedMS - rocket.igniteDelay;
          if (relativeTime < 0 || rocket.hasExploded && relativeTime > FUSE_DURATION_MS + LAUNCH_DURATION_MS + EXPLOSION_DURATION_MS) {
            return;
          }

          if (relativeTime < FUSE_DURATION_MS) {
            const pulse = 0.6 + Math.sin(relativeTime / 60) * 0.3;
            rocket.fuseGlow.scale.set(0.8 + pulse * 0.4);
            rocket.fuseGlow.alpha = 0.4 + pulse * 0.6;
            spawnFuseSpark(sparkLayer, sparkles, rocket.base);
            return;
          }

          const flightTime = relativeTime - FUSE_DURATION_MS;
          if (flightTime < LAUNCH_DURATION_MS) {
            const progress = clamp01(flightTime / LAUNCH_DURATION_MS);
            const vertical = easeOutCubic(progress);
            const lateral = easeOutQuad(progress);
            rocket.container.visible = true;
            rocket.flame.visible = true;
            rocket.fuseGlow.visible = false;
            rocket.container.position.set(
              lerp(rocket.base.x, rocket.peak.x, lateral),
              lerp(rocket.base.y, rocket.peak.y, vertical),
            );
            rocket.flame.scale.set(0.9 + Math.sin(elapsedMS / 80) * 0.1);
            rocket.trailTimer += deltaMS;
            if (rocket.trailTimer >= TRAIL_INTERVAL_MS) {
              rocket.trailTimer = 0;
              spawnTrailSpark(sparkLayer, sparkles, rocket.container.position, rocket.color);
            }
            return;
          }

          if (!rocket.hasExploded) {
            rocket.hasExploded = true;
            rocket.container.visible = false;
            rocket.flame.visible = false;
            const explosionPalette = [
              rocket.color,
              0xffffff,
              theme.chicken.beakHighlight,
              theme.chick.bodyPrimary,
              0x58b3ff,
            ];
            spawnExplosion(sparkLayer, sparkles, rocket.peak, explosionPalette);
          }
        });

        updateSparkles(sparkles, deltaMS);
      },
      onExit: () => {
        cleanup();
      },
    };
  },
});
