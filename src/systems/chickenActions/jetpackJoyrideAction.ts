import { Container, Graphics } from 'pixi.js';
import type { ChickenActionDefinition } from '../chickenActionSystem';
import { CHICKEN_IDLE_POSE } from '../../entities/chicken';
import { createJetpackRig } from '../../entities/jetpackRig';
import type { BehaviorControlHandle } from './behaviorControl';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const IGNITE_DURATION_MS = 900;
const FLIGHT_DURATION_MS = 2200;
const DESCENT_DURATION_MS = 1700;
const ACTION_DURATION_MS = IGNITE_DURATION_MS + FLIGHT_DURATION_MS + DESCENT_DURATION_MS;

const HEART_INTERVAL_MS = 120;

type HeartParticle = {
  sprite: Graphics;
  life: number;
  ttl: number;
  velocity: { x: number; y: number };
  spin: number;
};

const createParachute = (color: number) => {
  const container = new Container();
  container.visible = false;
  container.zIndex = 4;
  const canopy = new Graphics();
  canopy
    .moveTo(-70, 0)
    .quadraticCurveTo(0, -90, 70, 0)
    .lineTo(70, 6)
    .lineTo(-70, 6)
    .closePath()
    .fill({ color, alpha: 0.9 })
    .stroke({ color: 0xffffff, width: 3, alpha: 0.4 });

  const cords = new Graphics();
  cords
    .moveTo(-50, 6)
    .lineTo(-18, 52)
    .moveTo(-20, 6)
    .lineTo(-6, 52)
    .moveTo(20, 6)
    .lineTo(6, 52)
    .moveTo(50, 6)
    .lineTo(18, 52)
    .stroke({ color: 0xffffff, width: 2, alpha: 0.65 });

  container.addChild(canopy, cords);
  container.position.set(8, -128);
  return container;
};

export const createJetpackJoyrideAction = (): ChickenActionDefinition => ({
  id: 'jetpack-joyride',
  weight: 0.8,
  create: (context) => {
    const { chicken, environmentScene, theme, behaviorControls } = context;

    const rig = createJetpackRig({ theme });
    rig.view.position.set(-4, 30);
    rig.view.zIndex = 0.4;
    chicken.parts.body.addChild(rig.view);

    const parachute = createParachute(theme.chicken.bellyHighlight);
    chicken.parts.body.addChild(parachute);

    const heartLayer = new Container();
    heartLayer.sortableChildren = true;
    heartLayer.zIndex = 0.2;
    environmentScene.penLayer.addChild(heartLayer);

    const heartColors = [
      theme.chicken.comb,
      theme.chicken.wattle,
      theme.chick.bodyPrimary,
      theme.chicken.beakHighlight,
    ];

    const heartParticles: HeartParticle[] = [];
    let heartTimer = 0;

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
      heartLayer.addChild(sprite);
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

    const releaseBehaviorControl = () => {
      behaviorHandle?.release();
      behaviorHandle = null;
    };

    const peakHeight = Math.max(120, Math.abs(chicken.view.scale.y) * 260);
    const lateralRange = Math.max(36, peakHeight * 0.32);

    const applyShadowLift = (ratio: number) => {
      const clamped = clamp01(ratio);
      shadow.scale.set(
        baseShadow.scaleX * (1 - clamped * 0.25),
        baseShadow.scaleY * (1 - clamped * 0.35),
      );
      shadow.alpha = baseShadow.alpha * (1 - clamped * 0.5);
    };

    const cleanup = () => {
      rig.destroy();
      parachute.destroy();
      heartParticles.forEach((particle) => particle.sprite.destroy());
      heartParticles.length = 0;
      heartLayer.parent?.removeChild(heartLayer);
      heartLayer.destroy({ children: true });
      shadow.scale.set(baseShadow.scaleX, baseShadow.scaleY);
      shadow.alpha = baseShadow.alpha;
      chicken.view.position.set(basePosition.x, basePosition.y);
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
      },
      onUpdate: (deltaMS, elapsedMS) => {
        rig.update(deltaMS);
        updateHearts(deltaMS);

        const igniteEnd = IGNITE_DURATION_MS;
        const flightEnd = igniteEnd + FLIGHT_DURATION_MS;

        heartTimer += deltaMS;
        if (elapsedMS > igniteEnd && elapsedMS < flightEnd && heartTimer >= HEART_INTERVAL_MS) {
          heartTimer = 0;
          spawnHeart();
          const lastHeart = heartParticles[heartParticles.length - 1];
          if (lastHeart) {
            lastHeart.sprite.position.set(
              chicken.view.position.x - Math.sign(chicken.view.scale.x) * 24,
              chicken.view.position.y - 18,
            );
          }
        }

        let height = 0;
        let lateral = 0;
        if (elapsedMS <= igniteEnd) {
          const igniteProgress = clamp01(elapsedMS / igniteEnd);
          height = easeOutQuad(igniteProgress) * 18;
          lateral = 0;
        } else if (elapsedMS <= flightEnd) {
          const flightProgress = clamp01((elapsedMS - igniteEnd) / FLIGHT_DURATION_MS);
          height = 18 + easeInOutCubic(flightProgress) * (peakHeight - 18);
          lateral = Math.sin(flightProgress * Math.PI * 2) * lateralRange;
        } else {
          const descentProgress = clamp01((elapsedMS - flightEnd) / DESCENT_DURATION_MS);
          height = (1 - easeOutQuad(descentProgress)) * peakHeight;
          lateral = Math.sin(descentProgress * Math.PI) * lateralRange * 0.35;
        }

        chicken.view.position.set(basePosition.x + lateral, basePosition.y - height);
        applyShadowLift(height / peakHeight);

        const throttleTarget =
          elapsedMS <= flightEnd
            ? 0.5 + clamp01(height / peakHeight) * 0.5
            : Math.max(0, 0.6 - ((elapsedMS - flightEnd) / DESCENT_DURATION_MS) * 0.7);
        rig.setThrottle(throttleTarget);

        const poseLean = (CHICKEN_IDLE_POSE.bodyLean ?? 0) - 0.08 + throttleTarget * 0.18;
        chicken.setPose({
          bodyLean: poseLean,
          bodyLift: (CHICKEN_IDLE_POSE.bodyLift ?? 0) - 6 + throttleTarget * 14,
          headPitch: (CHICKEN_IDLE_POSE.headPitch ?? 0) + throttleTarget * 0.3,
          headBob: (CHICKEN_IDLE_POSE.headBob ?? 0) - height * 0.04,
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
          const openProgress = clamp01((elapsedMS - flightEnd) / (DESCENT_DURATION_MS * 0.4));
          parachute.visible = true;
          parachute.scale.set(0.4 + openProgress * 0.6, 0.4 + openProgress * 0.3);
          rig.setThrottle(throttleTarget * (1 - openProgress));
        } else {
          parachute.visible = false;
        }

        heartLayer.children.forEach((child) => {
          child.zIndex = child.position.y;
        });
      },
      onExit: () => {
        cleanup();
      },
    };
  },
});
