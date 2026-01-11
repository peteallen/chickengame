import { Container, Graphics } from 'pixi.js';
import type { ChickenActionDefinition } from '../chickenActionSystem';
import { CHICKEN_IDLE_POSE } from '../../entities/chicken';
import { createJetpackRig } from '../../entities/jetpackRig';
import type { Theme } from '../../config/theme';
import type { BehaviorControlHandle } from './behaviorControl';
import type { SoundPlaybackHandle } from '../../lib/audio/soundEffect';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const IGNITE_DURATION_MS = 850;
const FLIGHT_DURATION_MS = 2800;
const DESCENT_DURATION_MS = 2300;
const ACTION_DURATION_MS = IGNITE_DURATION_MS + FLIGHT_DURATION_MS + DESCENT_DURATION_MS;

const HEART_INTERVAL_MS = 95;
const SPARK_INTERVAL_MS = 45;

type HeartParticle = {
  sprite: Graphics;
  life: number;
  ttl: number;
  velocity: { x: number; y: number };
  spin: number;
};

type SparkParticle = {
  sprite: Graphics;
  life: number;
  ttl: number;
  velocity: { x: number; y: number };
  spin: number;
  startScale: number;
};

const createParachute = (theme: Theme) => {
  const container = new Container();
  container.visible = false;
  container.zIndex = 4;
  container.sortableChildren = true;

  const canopy = new Graphics();
  canopy.zIndex = 1;

  const radius = 138;
  const segmentCount = 7;
  const arcSteps = 8;
  const canopyColors = [
    theme.atmosphere.sunCore,
    theme.chicken.beakHighlight,
    theme.chicken.comb,
    theme.grass.accent,
    theme.atmosphere.cloudHighlight,
    theme.chicken.wattle,
    theme.chick.bodyPrimary,
  ];

  const sampleArcY = (x: number) => -Math.sqrt(Math.max(0, radius * radius - x * x));

  for (let i = 0; i < segmentCount; i += 1) {
    const x0 = lerp(-radius, radius, i / segmentCount);
    const x1 = lerp(-radius, radius, (i + 1) / segmentCount);
    canopy.moveTo(x0, 0);
    for (let step = 0; step <= arcSteps; step += 1) {
      const t = step / arcSteps;
      const x = lerp(x0, x1, t);
      canopy.lineTo(x, sampleArcY(x));
    }
    canopy
      .lineTo(x1, 0)
      .closePath()
      .fill({ color: canopyColors[i % canopyColors.length] ?? 0xffffff, alpha: 0.92 });
  }

  canopy
    .moveTo(-radius, 0)
    .arc(0, 0, radius, Math.PI, 0)
    .lineTo(radius, 10)
    .lineTo(-radius, 10)
    .closePath()
    .stroke({ color: 0xffffff, width: 4, alpha: 0.42 });

  const scallop = new Graphics();
  scallop.zIndex = 1.2;
  const scallopCount = 7;
  const scallopRadius = 18;
  for (let i = 0; i < scallopCount; i += 1) {
    const t = i / (scallopCount - 1);
    const x = lerp(-radius + 10, radius - 10, t);
    scallop
      .circle(x, 6, scallopRadius)
      .fill({ color: theme.atmosphere.cloudMid, alpha: 0.22 });
  }

  const canopyHighlight = new Graphics();
  canopyHighlight.zIndex = 1.1;
  canopyHighlight
    .ellipse(0, -radius * 0.55, radius * 0.42, radius * 0.25)
    .fill({ color: 0xffffff, alpha: 0.12 });

  const cap = new Graphics();
  cap.zIndex = 1.3;
  cap.circle(0, sampleArcY(0) + 6, 10).fill({ color: 0xffffff, alpha: 0.6 });
  cap.circle(0, sampleArcY(0) + 6, 10).stroke({ color: theme.chicken.outline, width: 3, alpha: 0.35 });

  const cords = new Graphics();
  cords.zIndex = 0.9;
  const cordTopY = 8;
  const cordBottomY = 118;
  const cordTargets = [
    { x: -radius * 0.65, y: cordTopY },
    { x: -radius * 0.32, y: cordTopY },
    { x: 0, y: cordTopY },
    { x: radius * 0.32, y: cordTopY },
    { x: radius * 0.65, y: cordTopY },
  ];
  cordTargets.forEach((start) => {
    cords
      .moveTo(start.x, start.y)
      .quadraticCurveTo(start.x * 0.55, cordBottomY * 0.55, start.x * 0.22, cordBottomY)
      .stroke({ color: 0xffffff, width: 2.6, alpha: 0.75 });
  });

  const harness = new Graphics();
  harness.zIndex = 0.95;
  harness
    .roundRect(-44, cordBottomY - 10, 88, 20, 10)
    .fill({ color: theme.chicken.comb, alpha: 0.28 })
    .stroke({ color: 0xffffff, width: 3, alpha: 0.35 });

  container.addChild(canopy, scallop, canopyHighlight, cap, cords, harness);
  container.position.set(10, -178);
  return container;
};

export const createJetpackJoyrideAction = (): ChickenActionDefinition => ({
  id: 'jetpack-joyride',
  weight: 0.8,
  create: (context) => {
    const {
      chicken,
      environmentScene,
      theme,
      behaviorControls,
      audioService,
      layerService,
      penBoundsService,
    } = context;

    const flightGroup = new Container();
    flightGroup.sortableChildren = true;
    flightGroup.zIndex = 1;

    const flightPivot = {
      x: chicken.metrics.body.offset.x,
      y: chicken.metrics.body.offset.y,
    };

    flightGroup.pivot.set(flightPivot.x, flightPivot.y);
    flightGroup.position.set(flightPivot.x, flightPivot.y);

    const flightParts = [
      chicken.parts.backFoot,
      chicken.parts.frontFoot,
      chicken.parts.body,
      chicken.parts.head,
    ];
    flightParts.forEach((part) => {
      chicken.view.removeChild(part);
      flightGroup.addChild(part);
    });
    chicken.view.addChild(flightGroup);

    const rig = createJetpackRig({ theme });
    rig.view.position.set(-4, 30);
    rig.view.zIndex = 0.4;
    chicken.parts.body.addChild(rig.view);

    const parachute = createParachute(theme);
    chicken.parts.body.addChild(parachute);

    const particleParent = layerService.getLayer('particles') ?? environmentScene.penLayer;
    const particleLayer = new Container();
    particleLayer.sortableChildren = true;
    particleLayer.zIndex = 5;
    particleParent.addChild(particleLayer);

    const heartColors = [
      theme.chicken.comb,
      theme.chicken.wattle,
      theme.chick.bodyPrimary,
      theme.chicken.beakHighlight,
    ];

    const heartParticles: HeartParticle[] = [];
    const sparkParticles: SparkParticle[] = [];
    let heartTimer = 0;
    let sparkTimer = 0;

    const spawnHeart = () => {
      const color = heartColors[Math.floor(Math.random() * heartColors.length)];
      const sprite = new Graphics();
      sprite
        .moveTo(0, 6)
        .quadraticCurveTo(-10, -8, 0, -18)
        .quadraticCurveTo(10, -8, 0, 6)
        .fill({ color, alpha: 0.9 })
        .stroke({ color: 0xffffff, width: 1.8, alpha: 0.35 });
      sprite.pivot.set(0, 0);
      particleLayer.addChild(sprite);
      heartParticles.push({
        sprite,
        life: 0,
        ttl: 1200 + Math.random() * 400,
        velocity: {
          x: (Math.random() - 0.5) * 0.05,
          y: -0.065 - Math.random() * 0.02,
        },
        spin: (Math.random() - 0.5) * 0.003,
      });
    };

    const sparkColors = [
      theme.atmosphere.sunCore,
      theme.chicken.beakHighlight,
      theme.chicken.comb,
      theme.grass.accent,
      theme.atmosphere.cloudHighlight,
    ];

    const spawnSpark = (options: { x: number; y: number; facingSign: number; intensity: number }) => {
      const { x, y, facingSign, intensity } = options;
      const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];
      const sprite = new Graphics();
      const radius = 3 + Math.random() * 4.2 * intensity;
      sprite
        .moveTo(0, -radius)
        .lineTo(radius * 0.85, 0)
        .lineTo(0, radius)
        .lineTo(-radius * 0.85, 0)
        .closePath()
        .fill({ color: color ?? 0xffffff, alpha: 0.85 })
        .stroke({ color: 0xffffff, width: 1.4, alpha: 0.25 });
      sprite.position.set(x, y);
      particleLayer.addChild(sprite);

      const backward = -facingSign;
      const baseSpeed = 0.16 + intensity * 0.22;
      sparkParticles.push({
        sprite,
        life: 0,
        ttl: 520 + Math.random() * 320,
        velocity: {
          x: (backward * baseSpeed + (Math.random() - 0.5) * 0.18) * 0.9,
          y: (0.22 + intensity * 0.26 + Math.random() * 0.14) * 0.85,
        },
        spin: (Math.random() - 0.5) * 0.01,
        startScale: 0.55 + Math.random() * 0.55,
      });
    };

    const updateHearts = (deltaMS: number) => {
      for (let i = heartParticles.length - 1; i >= 0; i -= 1) {
        const particle = heartParticles[i];
        particle.life += deltaMS;
        const age = particle.life / particle.ttl;
        if (age >= 1) {
          particle.sprite.destroy();
          heartParticles.splice(i, 1);
          continue;
        }
        particle.sprite.position.x += particle.velocity.x * deltaMS;
        particle.sprite.position.y += particle.velocity.y * deltaMS;
        particle.sprite.rotation += particle.spin * deltaMS;
        const scale = 0.5 + age * 0.6;
        particle.sprite.scale.set(scale);
        particle.sprite.alpha = 1 - age;
      }
    };

    const updateSparks = (deltaMS: number) => {
      for (let i = sparkParticles.length - 1; i >= 0; i -= 1) {
        const particle = sparkParticles[i];
        particle.life += deltaMS;
        const age = particle.life / particle.ttl;
        if (age >= 1) {
          particle.sprite.destroy();
          sparkParticles.splice(i, 1);
          continue;
        }
        particle.sprite.position.x += particle.velocity.x * deltaMS;
        particle.sprite.position.y += particle.velocity.y * deltaMS;
        particle.sprite.rotation += particle.spin * deltaMS;
        const scale = particle.startScale * (1 - age * 0.35);
        particle.sprite.scale.set(scale);
        particle.sprite.alpha = 1 - age;
      }
    };

    const basePosition = {
      x: chicken.view.position.x,
      y: chicken.view.position.y,
    };
    const shadow = chicken.parts.shadow;
    const baseShadow = {
      scaleX: shadow.scale.x,
      scaleY: shadow.scale.y,
      alpha: shadow.alpha,
    };

    let behaviorHandle: BehaviorControlHandle | null = null;
    let jetpackSound: SoundPlaybackHandle | null = null;

    const baseFlightGroup = {
      rotation: flightGroup.rotation,
      scaleX: flightGroup.scale.x,
      scaleY: flightGroup.scale.y,
      x: flightGroup.position.x,
      y: flightGroup.position.y,
      pivotX: flightGroup.pivot.x,
      pivotY: flightGroup.pivot.y,
    };

    const releaseBehaviorControl = () => {
      behaviorHandle?.release();
      behaviorHandle = null;
    };

    const baseScale = Math.max(0.001, Math.abs(chicken.view.scale.y));
    const penSnapshot = penBoundsService.getSnapshot();
    const penDepth =
      penSnapshot?.bounds.polygon
        ? (penSnapshot.bounds.polygon.frontLeft.y + penSnapshot.bounds.polygon.frontRight.y) / 2 -
          (penSnapshot.bounds.polygon.backLeft.y + penSnapshot.bounds.polygon.backRight.y) / 2
        : 260;
    const peakHeightWorld = Math.max(340, baseScale * 1100, penDepth * 1.85);
    const lateralRangeWorld = Math.max(
      70,
      Math.min(180, (penSnapshot?.frontWidth ?? 420) * 0.22),
    );

    const applyShadowLift = (ratio: number) => {
      const clamped = easeOutQuad(clamp01(ratio));
      shadow.scale.set(
        baseShadow.scaleX * lerp(1, 0.38, clamped),
        baseShadow.scaleY * lerp(1, 0.22, clamped),
      );
      shadow.alpha = baseShadow.alpha * lerp(1, 0.18, clamped);
    };

    const cleanup = () => {
      rig.destroy();
      parachute.destroy();
      heartParticles.forEach((particle) => particle.sprite.destroy());
      heartParticles.length = 0;
      sparkParticles.forEach((particle) => particle.sprite.destroy());
      sparkParticles.length = 0;
      particleLayer.parent?.removeChild(particleLayer);
      particleLayer.destroy({ children: true });

      shadow.scale.set(baseShadow.scaleX, baseShadow.scaleY);
      shadow.alpha = baseShadow.alpha;
      chicken.view.position.set(basePosition.x, basePosition.y);
      chicken.resetPose();

      flightParts.forEach((part) => {
        if (part.parent === flightGroup) {
          flightGroup.removeChild(part);
          chicken.view.addChild(part);
        }
      });
      flightGroup.position.set(baseFlightGroup.x, baseFlightGroup.y);
      flightGroup.pivot.set(baseFlightGroup.pivotX, baseFlightGroup.pivotY);
      flightGroup.rotation = baseFlightGroup.rotation;
      flightGroup.scale.set(baseFlightGroup.scaleX, baseFlightGroup.scaleY);
      flightGroup.parent?.removeChild(flightGroup);
      flightGroup.destroy({ children: false });

      jetpackSound?.stop();
      jetpackSound = null;
      releaseBehaviorControl();
    };

    return {
      durationMS: ACTION_DURATION_MS,
      onEnter: () => {
        behaviorHandle = behaviorControls.takeover({
          animatorAuthority: 'external',
          stateLock: 'idle',
          speedMultiplier: 0,
          followerEnabled: false,
        });
        applyShadowLift(0);
        jetpackSound = audioService.playEffect('jetpackAirLeakLoop', { loop: true, volume: 0.55 });
      },
      onUpdate: (deltaMS, elapsedMS) => {
        rig.update(deltaMS);
        updateHearts(deltaMS);
        updateSparks(deltaMS);

        const igniteEnd = IGNITE_DURATION_MS;
        const flightEnd = igniteEnd + FLIGHT_DURATION_MS;
        const facingSign = Math.sign(chicken.view.scale.x) || 1;

        heartTimer += deltaMS;
        sparkTimer += deltaMS;

        let heightWorld = 0;
        let lateralWorld = 0;
        let tilt = 0;
        let spin = 0;
        if (elapsedMS <= igniteEnd) {
          const igniteProgress = clamp01(elapsedMS / igniteEnd);
          const rumble = Math.sin(elapsedMS * 0.05) * (1 - igniteProgress) * 3;
          heightWorld = easeOutQuad(igniteProgress) * 74;
          lateralWorld = rumble * 0.55;
          tilt = rumble * 0.01;
        } else if (elapsedMS <= flightEnd) {
          const flightProgress = clamp01((elapsedMS - igniteEnd) / FLIGHT_DURATION_MS);
          const ascentPhase = clamp01(flightProgress / 0.45);
          const cruisePhase = clamp01((flightProgress - 0.45) / 0.55);

          const ascentHeight = lerp(74, peakHeightWorld, easeInOutCubic(ascentPhase));
          const bob = Math.sin((elapsedMS - igniteEnd) * 0.006) * (8 + cruisePhase * 14);
          heightWorld = ascentPhase < 1 ? ascentHeight : peakHeightWorld + bob;

          const glide = 0.25 + ascentPhase * 0.75;
          lateralWorld = Math.sin(flightProgress * Math.PI * 2) * lateralRangeWorld * glide;

          tilt = (lateralWorld / lateralRangeWorld) * 0.22;
          spin = cruisePhase > 0 ? easeInOutCubic(cruisePhase) * Math.PI * 2 : 0;
        } else {
          const descentProgress = clamp01((elapsedMS - flightEnd) / DESCENT_DURATION_MS);
          heightWorld = lerp(peakHeightWorld, 0, easeOutQuad(descentProgress));
          lateralWorld =
            Math.sin(descentProgress * Math.PI * 2) * lateralRangeWorld * (0.12 + 0.18 * (1 - descentProgress));
          tilt = (lateralWorld / lateralRangeWorld) * 0.12;
          spin = 0;
        }

        const heightRatio = clamp01(heightWorld / peakHeightWorld);
        const airWorld = {
          x: basePosition.x + lateralWorld,
          y: basePosition.y - heightWorld,
        };

        if (elapsedMS > igniteEnd && elapsedMS < flightEnd && heartTimer >= HEART_INTERVAL_MS) {
          heartTimer = 0;
          spawnHeart();
          const lastHeart = heartParticles[heartParticles.length - 1];
          if (lastHeart) {
            lastHeart.sprite.position.set(
              airWorld.x - facingSign * 24,
              airWorld.y - 18,
            );
          }
        }

        if (elapsedMS <= flightEnd && sparkTimer >= SPARK_INTERVAL_MS) {
          sparkTimer = 0;
          const intensity = 0.35 + heightRatio * 0.85;
          spawnSpark({
            x: airWorld.x - facingSign * (18 + heightRatio * 10),
            y: airWorld.y + 24 + heightRatio * 16,
            facingSign,
            intensity,
          });
        }

        chicken.view.position.set(airWorld.x, basePosition.y);
        flightGroup.position.y = flightPivot.y - (heightWorld / baseScale);
        flightGroup.position.x = flightPivot.x;
        flightGroup.rotation = tilt + spin;
        const altitudeScale = 1 - easeOutQuad(heightRatio) * 0.085;
        flightGroup.scale.set(altitudeScale);
        applyShadowLift(heightRatio);

        const throttleTarget = (() => {
          if (elapsedMS <= igniteEnd) {
            const t = clamp01(elapsedMS / igniteEnd);
            return 0.25 + t * 0.65;
          }
          if (elapsedMS <= flightEnd) {
            return 0.72 + heightRatio * 0.28 + Math.sin(elapsedMS * 0.02) * 0.05;
          }
          const descentProgress = clamp01((elapsedMS - flightEnd) / DESCENT_DURATION_MS);
          return Math.max(0, 0.25 * (1 - descentProgress * 1.2));
        })();
        rig.setThrottle(throttleTarget);
        jetpackSound?.setVolume(0.22 + throttleTarget * 0.58);

        const poseLean = (CHICKEN_IDLE_POSE.bodyLean ?? 0) - 0.08 + throttleTarget * 0.18;
        chicken.setPose({
          bodyLean: poseLean,
          bodyLift: (CHICKEN_IDLE_POSE.bodyLift ?? 0) - 6 + throttleTarget * 14,
          headPitch: (CHICKEN_IDLE_POSE.headPitch ?? 0) + throttleTarget * 0.3,
          headBob: (CHICKEN_IDLE_POSE.headBob ?? 0) - heightRatio * 18,
          wingLift: -6 + throttleTarget * 32,
          wingPitch: throttleTarget * 0.5,
          tailLift: (CHICKEN_IDLE_POSE.tailLift ?? 0) + throttleTarget * 0.2,
          tailSplay: (CHICKEN_IDLE_POSE.tailSplay ?? 0.4) + throttleTarget * 0.1,
          beakOpen: (CHICKEN_IDLE_POSE.beakOpen ?? 0.05) + throttleTarget * 0.08,
          stride: 0,
          frontFootLift: -6 * throttleTarget,
          backFootLift: -4 * throttleTarget,
        });

        if (elapsedMS >= flightEnd) {
          const descentProgress = clamp01((elapsedMS - flightEnd) / DESCENT_DURATION_MS);
          const openProgress = clamp01((elapsedMS - flightEnd) / (DESCENT_DURATION_MS * 0.32));
          parachute.visible = true;
          const openEase = easeOutQuad(openProgress);
          parachute.scale.set(lerp(0.06, 1.25, openEase), lerp(0.06, 1.02, openEase));
          parachute.rotation = Math.sin(elapsedMS * 0.003) * (0.06 + openEase * 0.08);
          parachute.position.x = 10 + Math.sin(elapsedMS * 0.0021) * (3 + openEase * 5);
          rig.setThrottle(throttleTarget * (1 - openEase));
          flightGroup.rotation += Math.sin(descentProgress * Math.PI * 2) * 0.08 * openEase;
        } else {
          parachute.visible = false;
          parachute.rotation = 0;
          parachute.position.x = 10;
        }

        particleLayer.children.forEach((child) => {
          child.zIndex = child.position.y;
        });
      },
      onExit: () => {
        cleanup();
      },
    };
  },
});
