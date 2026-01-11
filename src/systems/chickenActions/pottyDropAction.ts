import { Container, Graphics } from 'pixi.js';
import type { ChickenActionDefinition } from '../chickenActionSystem';
import { CHICKEN_IDLE_POSE } from '../../entities/chicken';
import { createPotty, POTTY_METRICS, type Potty } from '../../entities/potty';
import type { BehaviorControlHandle } from './behaviorControl';

// --- Utility functions ---
const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const clamp01 = (value: number) => clamp(value, 0, 1);
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const randRange = (min: number, max: number) => min + Math.random() * (max - min);
const pickRandom = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const easeInQuad = (t: number) => t * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeOutBounce = (t: number): number => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;

// --- Timing constants ---
const POTTY_FALL_DURATION_MS = 1200;
const POTTY_LAND_PAUSE_MS = 400;
const CHICKEN_APPROACH_MS = 800;
const CHICKEN_CLIMB_MS = 600;
const BUSINESS_DURATION_MS = 3600;
const CHICKEN_DISMOUNT_MS = 700;
const POST_DISMOUNT_GLOAT_MS = 900;
const FLUSH_DURATION_MS = 800;
const CONFETTI_CELEBRATION_MS = 1200;
const POTTY_EXIT_DURATION_MS = 1000;

// Phase boundaries
const LAND_END_MS = POTTY_FALL_DURATION_MS + POTTY_LAND_PAUSE_MS;
const APPROACH_END_MS = LAND_END_MS + CHICKEN_APPROACH_MS;
const CLIMB_END_MS = APPROACH_END_MS + CHICKEN_CLIMB_MS;
const BUSINESS_END_MS = CLIMB_END_MS + BUSINESS_DURATION_MS;
const DISMOUNT_END_MS = BUSINESS_END_MS + CHICKEN_DISMOUNT_MS;
const GLOAT_END_MS = DISMOUNT_END_MS + POST_DISMOUNT_GLOAT_MS;
const FLUSH_END_MS = GLOAT_END_MS + FLUSH_DURATION_MS;
const CONFETTI_END_MS = FLUSH_END_MS + CONFETTI_CELEBRATION_MS;
const ACTION_DURATION_MS = CONFETTI_END_MS + POTTY_EXIT_DURATION_MS;

// Comedy timing within business phase
const THE_MOMENT_OFFSET_MS = 2600;
const THE_MOMENT_START_MS = CLIMB_END_MS + THE_MOMENT_OFFSET_MS;
const THE_MOMENT_DURATION_MS = 350;
const RELIEF_START_MS = THE_MOMENT_START_MS + THE_MOMENT_DURATION_MS;

// --- Particle types ---
type DustParticle = {
  sprite: Graphics;
  life: number;
  ttl: number;
  velocity: { x: number; y: number };
  gravity: number;
  startScale: number;
};

type SweatDrop = {
  sprite: Graphics;
  life: number;
  ttl: number;
  velocity: { x: number; y: number };
  gravity: number;
};

type ConfettiParticle = {
  sprite: Graphics;
  life: number;
  ttl: number;
  velocity: { x: number; y: number };
  gravity: number;
  spin: number;
  flutter: number;
  flutterPhase: number;
  startScale: number;
};

type SmokeParticle = {
  sprite: Graphics;
  life: number;
  ttl: number;
  velocity: { x: number; y: number };
  startScale: number;
};

// --- Colors ---
const DUST_COLORS = [0xd4c9a8, 0xc9bea0, 0xe0d5b8];
const SWEAT_COLORS = [0x7ec8e3, 0x89cff0, 0x73c2fb];
const SMOKE_COLORS = [0xe8e8e8, 0xd0d0d0, 0xc0c0c0];

export const createPottyDropAction = (): ChickenActionDefinition => ({
  id: 'potty-drop',
  weight: 0.85,
  create: (context) => {
    const {
      chicken,
      environmentScene,
      theme,
      depthSystem,
      behaviorControls,
      audioService,
    } = context;
    const penLayer = environmentScene.penLayer;

    // --- State variables ---
    let potty: Potty | null = null;
    let behaviorHandle: BehaviorControlHandle | null = null;
    let controlReleased = false;

    const basePosition = { x: chicken.view.position.x, y: chicken.view.position.y };
    let pottyTargetPosition = { x: 0, y: 0 };
    const pottyStartY = -200;

    // Phase flags
    let pottySpawned = false;
    let pottyLanded = false;
    let chickenOnPotty = false;
    let businessStarted = false;
    let chickenDismounted = false;
    let contentsRevealed = false;
    let flushStarted = false;
    let confettiSpawned = false;
    let rocketStarted = false;

    // Sound flags
    let fartSoundPlayed = false;
    let plopSoundPlayed = false;
    let flushSoundPlayed = false;

    // Particle arrays
    const dustParticles: DustParticle[] = [];
    const sweatDrops: SweatDrop[] = [];
    const confettiParticles: ConfettiParticle[] = [];
    const smokeParticles: SmokeParticle[] = [];

    // Layers
    const effectsLayer = new Container();
    effectsLayer.sortableChildren = true;
    effectsLayer.zIndex = 50;

    const confettiLayer = new Container();
    confettiLayer.sortableChildren = true;
    confettiLayer.zIndex = 100;

    // Newspaper prop
    let newspaper: Container | null = null;
    let sweatTimer = 0;

    // Shadow tracking
    const shadow = chicken.parts.shadow;
    const baseShadow = { scaleX: shadow.scale.x, scaleY: shadow.scale.y, alpha: shadow.alpha };

    // --- Helper functions ---
    const releaseBehaviorControl = () => {
      if (controlReleased) return;
      controlReleased = true;
      behaviorHandle?.release();
      behaviorHandle = null;
      chicken.view.position.set(basePosition.x, basePosition.y);
      chicken.resetPose();
      shadow.scale.set(baseShadow.scaleX, baseShadow.scaleY);
      shadow.alpha = baseShadow.alpha;
    };

    const applyShadowLift = (ratio: number) => {
      const c = clamp01(ratio);
      shadow.scale.set(baseShadow.scaleX * (1 - c * 0.4), baseShadow.scaleY * (1 - c * 0.5));
      shadow.alpha = baseShadow.alpha * (1 - c * 0.6);
    };

    const spawnPotty = () => {
      if (potty || pottySpawned) return;
      pottySpawned = true;

      const facing = chicken.getFacing();
      const offsetX = facing === 'left' ? 100 : -100;
      pottyTargetPosition = {
        x: basePosition.x + offsetX,
        y: basePosition.y + chicken.metrics.feet.groundY * Math.abs(chicken.view.scale.y),
      };

      const pottyEntity = createPotty(theme);
      const scale = Math.abs(chicken.view.scale.y) * 1.7;
      pottyEntity.view.scale.set(scale, scale);
      pottyEntity.view.position.set(pottyTargetPosition.x, pottyStartY);

      penLayer.addChild(pottyEntity.view);
      depthSystem.register({
        target: pottyEntity.view,
        layer: 0,
        getDepth: () => pottyEntity.view.position.y + POTTY_METRICS.shadow.offsetY * scale,
        bias: 0.15,
      });

      potty = pottyEntity;
    };

    const removePotty = () => {
      if (!potty) return;
      depthSystem.unregister(potty.view);
      potty.view.parent?.removeChild(potty.view);
      potty.destroy();
      potty = null;
    };

    // --- Dust particles (on landing) ---
    const spawnDustPuff = (position: { x: number; y: number }) => {
      const count = 12;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI + randRange(-0.3, 0.3);
        const speed = randRange(40, 90);
        const color = pickRandom(DUST_COLORS);

        const sprite = new Graphics();
        sprite.circle(0, 0, randRange(3, 7)).fill({ color, alpha: 0.7 });
        sprite.position.set(position.x, position.y);
        effectsLayer.addChild(sprite);

        dustParticles.push({
          sprite,
          life: 0,
          ttl: randRange(400, 700),
          velocity: { x: Math.cos(angle) * speed, y: -Math.abs(Math.sin(angle)) * speed * 0.4 },
          gravity: 120,
          startScale: randRange(0.6, 1.2),
        });
      }
    };

    // --- Sweat drops (during business) ---
    const spawnSweatDrop = (position: { x: number; y: number }) => {
      const color = pickRandom(SWEAT_COLORS);
      const sprite = new Graphics();
      // Teardrop shape
      sprite
        .moveTo(0, -6)
        .quadraticCurveTo(-4, 0, 0, 6)
        .quadraticCurveTo(4, 0, 0, -6)
        .fill({ color, alpha: 0.85 });
      sprite.position.set(position.x + randRange(-15, 15), position.y - 60);
      sprite.scale.set(0.8);
      effectsLayer.addChild(sprite);

      sweatDrops.push({
        sprite,
        life: 0,
        ttl: randRange(500, 700),
        velocity: { x: randRange(-30, 30), y: randRange(-80, -40) },
        gravity: 280,
      });
    };

    // --- Newspaper prop ---
    const createNewspaper = (): Container => {
      const paper = new Container();
      const page = new Graphics();
      page
        .roundRect(-16, -22, 32, 44, 2)
        .fill({ color: 0xfff8e8, alpha: 0.95 })
        .stroke({ color: 0xd0c8b0, width: 1.5 });

      // Text lines
      const lines = new Graphics();
      for (let i = 0; i < 5; i++) {
        lines.rect(-12, -16 + i * 8, 24, 2).fill({ color: 0x888888, alpha: 0.35 });
      }

      paper.addChild(page, lines);
      paper.scale.set(0.6);
      return paper;
    };

    const spawnNewspaper = () => {
      if (newspaper) return;
      newspaper = createNewspaper();
      // Position near chicken's wing
      newspaper.position.set(
        chicken.view.position.x + (chicken.getFacing() === 'left' ? -40 : 40),
        chicken.view.position.y - 50
      );
      effectsLayer.addChild(newspaper);
    };

    const removeNewspaper = () => {
      if (!newspaper) return;
      newspaper.parent?.removeChild(newspaper);
      newspaper.destroy({ children: true });
      newspaper = null;
    };

    // --- Confetti burst ---
    const spawnConfettiBurst = (position: { x: number; y: number }) => {
      if (confettiSpawned) return;
      confettiSpawned = true;
      penLayer.addChild(confettiLayer);

      const colors = [
        theme.chicken.comb,
        theme.chicken.wattle,
        theme.chick.bodyPrimary,
        0xffd700, 0x66d2ff, 0xb47bff, 0xff85ec, 0xb1ff9b,
      ];

      const shapes: Array<'rect' | 'circle' | 'star'> = ['rect', 'circle', 'star'];
      const count = 55;

      for (let i = 0; i < count; i++) {
        const angle = randRange(-Math.PI * 0.85, -Math.PI * 0.15);
        const speed = randRange(180, 320);
        const color = pickRandom(colors);
        const shape = pickRandom(shapes);

        const sprite = new Graphics();
        if (shape === 'rect') {
          sprite.roundRect(-3, -5, 6, 10, 1).fill({ color, alpha: 0.95 });
        } else if (shape === 'circle') {
          sprite.circle(0, 0, 4).fill({ color, alpha: 0.9 });
        } else {
          // Star
          for (let j = 0; j < 5; j++) {
            const outerAngle = (j / 5) * Math.PI * 2 - Math.PI / 2;
            const innerAngle = outerAngle + Math.PI / 5;
            if (j === 0) sprite.moveTo(Math.cos(outerAngle) * 5, Math.sin(outerAngle) * 5);
            else sprite.lineTo(Math.cos(outerAngle) * 5, Math.sin(outerAngle) * 5);
            sprite.lineTo(Math.cos(innerAngle) * 2.5, Math.sin(innerAngle) * 2.5);
          }
          sprite.closePath().fill({ color, alpha: 0.95 });
        }

        sprite.position.set(position.x + randRange(-30, 30), position.y - 30);
        confettiLayer.addChild(sprite);

        confettiParticles.push({
          sprite,
          life: 0,
          ttl: randRange(1600, 2400),
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          gravity: randRange(220, 320),
          spin: randRange(-10, 10),
          flutter: randRange(0.004, 0.008),
          flutterPhase: Math.random() * Math.PI * 2,
          startScale: randRange(0.7, 1.3),
        });
      }
    };

    // --- Smoke particles (rocket exit) ---
    const spawnSmokeParticle = (position: { x: number; y: number }) => {
      const color = pickRandom(SMOKE_COLORS);
      const sprite = new Graphics();
      sprite.circle(0, 0, randRange(8, 14)).fill({ color, alpha: 0.6 });
      sprite.position.set(position.x + randRange(-10, 10), position.y);
      effectsLayer.addChild(sprite);

      smokeParticles.push({
        sprite,
        life: 0,
        ttl: randRange(600, 900),
        velocity: { x: randRange(-20, 20), y: randRange(10, 30) },
        startScale: randRange(0.8, 1.2),
      });
    };

    // --- Particle update functions ---
    const updateDust = (deltaMS: number) => {
      const dt = deltaMS / 1000;
      for (let i = dustParticles.length - 1; i >= 0; i--) {
        const p = dustParticles[i];
        p.life += deltaMS;
        if (p.life >= p.ttl) {
          p.sprite.destroy();
          dustParticles.splice(i, 1);
          continue;
        }
        const age = p.life / p.ttl;
        p.velocity.y += p.gravity * dt;
        p.sprite.x += p.velocity.x * dt;
        p.sprite.y += p.velocity.y * dt;
        p.sprite.scale.set(p.startScale * (1 + age * 0.5));
        p.sprite.alpha = (1 - age) * 0.7;
      }
    };

    const updateSweat = (deltaMS: number) => {
      const dt = deltaMS / 1000;
      for (let i = sweatDrops.length - 1; i >= 0; i--) {
        const p = sweatDrops[i];
        p.life += deltaMS;
        if (p.life >= p.ttl) {
          p.sprite.destroy();
          sweatDrops.splice(i, 1);
          continue;
        }
        const age = p.life / p.ttl;
        p.velocity.y += p.gravity * dt;
        p.sprite.x += p.velocity.x * dt;
        p.sprite.y += p.velocity.y * dt;
        p.sprite.alpha = (1 - age) * 0.85;
      }
    };

    const updateConfetti = (deltaMS: number) => {
      const dt = deltaMS / 1000;
      for (let i = confettiParticles.length - 1; i >= 0; i--) {
        const p = confettiParticles[i];
        p.life += deltaMS;
        if (p.life >= p.ttl) {
          p.sprite.destroy();
          confettiParticles.splice(i, 1);
          continue;
        }
        const age = p.life / p.ttl;
        p.velocity.y += p.gravity * dt;
        const flutter = Math.sin(p.life * p.flutter + p.flutterPhase) * 40 * dt;
        p.velocity.x *= 0.995;
        p.sprite.x += p.velocity.x * dt + flutter;
        p.sprite.y += p.velocity.y * dt;
        p.sprite.rotation += p.spin * dt;
        p.sprite.scale.set(p.startScale * (1 - age * 0.3));
        p.sprite.alpha = 1 - Math.pow(age, 1.5);
      }
    };

    const updateSmoke = (deltaMS: number) => {
      const dt = deltaMS / 1000;
      for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i];
        p.life += deltaMS;
        if (p.life >= p.ttl) {
          p.sprite.destroy();
          smokeParticles.splice(i, 1);
          continue;
        }
        const age = p.life / p.ttl;
        p.sprite.x += p.velocity.x * dt;
        p.sprite.y += p.velocity.y * dt;
        p.sprite.scale.set(p.startScale * (1 + age * 1.5));
        p.sprite.alpha = (1 - age) * 0.5;
      }
    };

    // --- Cleanup ---
    const cleanup = () => {
      dustParticles.forEach((p) => p.sprite.destroy());
      dustParticles.length = 0;
      sweatDrops.forEach((p) => p.sprite.destroy());
      sweatDrops.length = 0;
      confettiParticles.forEach((p) => p.sprite.destroy());
      confettiParticles.length = 0;
      smokeParticles.forEach((p) => p.sprite.destroy());
      smokeParticles.length = 0;

      removeNewspaper();

      effectsLayer.parent?.removeChild(effectsLayer);
      effectsLayer.destroy({ children: true });
      confettiLayer.parent?.removeChild(confettiLayer);
      confettiLayer.destroy({ children: true });
    };

    // --- Action instance ---
    return {
      durationMS: ACTION_DURATION_MS,

      onEnter: () => {
        controlReleased = false;
        behaviorHandle = behaviorControls.takeover({
          animatorAuthority: 'external',
          stateLock: 'idle',
          speedMultiplier: 0,
          followerEnabled: false,
        });
        chicken.resetPose();
        penLayer.addChild(effectsLayer);
        spawnPotty();
      },

      onUpdate: (deltaMS, elapsedMS) => {
        potty?.update(deltaMS);
        updateDust(deltaMS);
        updateSweat(deltaMS);
        updateConfetti(deltaMS);
        updateSmoke(deltaMS);

        // ===== PHASE 1: Potty falling =====
        if (elapsedMS <= POTTY_FALL_DURATION_MS && potty) {
          const fallProgress = clamp01(elapsedMS / POTTY_FALL_DURATION_MS);
          const eased = easeOutBounce(fallProgress);
          const currentY = lerp(pottyStartY, pottyTargetPosition.y, eased);
          potty.view.position.y = currentY;

          // Chicken looks up in surprise
          const lookProgress = clamp01(elapsedMS / 400);
          chicken.setPose({
            ...CHICKEN_IDLE_POSE,
            headPitch: lerp(CHICKEN_IDLE_POSE.headPitch, 0.5, easeOutCubic(lookProgress)),
            headBob: lerp(CHICKEN_IDLE_POSE.headBob, -15, easeOutCubic(lookProgress)),
            beakOpen: lerp(CHICKEN_IDLE_POSE.beakOpen, 0.3, lookProgress),
          });
        }

        // ===== Landing impact =====
        if (elapsedMS > POTTY_FALL_DURATION_MS && !pottyLanded) {
          pottyLanded = true;
          spawnDustPuff({ x: pottyTargetPosition.x, y: pottyTargetPosition.y + 30 });

          // Startle pose
          chicken.setPose({
            ...CHICKEN_IDLE_POSE,
            bodyLift: CHICKEN_IDLE_POSE.bodyLift + 8,
            wingLift: 25,
            beakOpen: 0.4,
          });
        }

        // ===== PHASE 2: Land pause (settle) =====
        if (elapsedMS > POTTY_FALL_DURATION_MS && elapsedMS <= LAND_END_MS) {
          const settleProgress = clamp01((elapsedMS - POTTY_FALL_DURATION_MS) / POTTY_LAND_PAUSE_MS);
          chicken.setPose({
            ...CHICKEN_IDLE_POSE,
            bodyLift: lerp(CHICKEN_IDLE_POSE.bodyLift + 8, CHICKEN_IDLE_POSE.bodyLift, easeOutCubic(settleProgress)),
            wingLift: lerp(25, CHICKEN_IDLE_POSE.wingLift, easeOutCubic(settleProgress)),
            beakOpen: lerp(0.4, CHICKEN_IDLE_POSE.beakOpen, settleProgress),
            headPitch: lerp(0.5, 0.1, settleProgress),
          });
        }

        // ===== PHASE 3: Chicken approaches =====
        if (elapsedMS > LAND_END_MS && elapsedMS <= APPROACH_END_MS && potty) {
          const approachProgress = clamp01((elapsedMS - LAND_END_MS) / CHICKEN_APPROACH_MS);
          const facing = chicken.getFacing();
          const targetX = pottyTargetPosition.x + (facing === 'left' ? -35 : 35);
          chicken.view.position.x = lerp(basePosition.x, targetX, easeInOutSine(approachProgress));

          // Walk pose
          const stride = Math.sin(approachProgress * Math.PI * 4) * 0.3;
          chicken.setPose({
            ...CHICKEN_IDLE_POSE,
            stride,
            headForward: 8,
            headPitch: 0.15,
          });
        }

        // ===== PHASE 4: Climb onto potty =====
        if (elapsedMS > APPROACH_END_MS && elapsedMS <= CLIMB_END_MS) {
          const climbProgress = clamp01((elapsedMS - APPROACH_END_MS) / CHICKEN_CLIMB_MS);

          // Hop up
          const hopHeight = Math.sin(climbProgress * Math.PI) * 25;
          const liftAmount = easeOutBack(climbProgress) * POTTY_METRICS.seatHeight * 1.1;
          chicken.view.position.y = basePosition.y - liftAmount - hopHeight;
          applyShadowLift(liftAmount / 65);

          chicken.setPose({
            ...CHICKEN_IDLE_POSE,
            bodyLift: CHICKEN_IDLE_POSE.bodyLift + 22 * climbProgress,
            wingLift: 15 * Math.sin(climbProgress * Math.PI),
            frontFootLift: -18 * climbProgress,
            backFootLift: -14 * climbProgress,
          });

          if (climbProgress >= 1 && !chickenOnPotty) {
            chickenOnPotty = true;
            potty?.setSeatGlow(true);
            spawnNewspaper();
          }
        }

        // ===== PHASE 5: Business time =====
        if (elapsedMS > CLIMB_END_MS && elapsedMS <= BUSINESS_END_MS) {
          if (!businessStarted) {
            businessStarted = true;
          }

          const businessProgress = clamp01((elapsedMS - CLIMB_END_MS) / BUSINESS_DURATION_MS);
          const facing = chicken.getFacing();
          const onPottyX = pottyTargetPosition.x + (facing === 'left' ? -35 : 35);
          const onPottyY = basePosition.y - POTTY_METRICS.seatHeight * 1.1;

          // Spawn sweat drops periodically during strain
          sweatTimer += deltaMS;
          if (sweatTimer > 400 && businessProgress < 0.7 && sweatDrops.length < 3) {
            sweatTimer = 0;
            spawnSweatDrop({ x: chicken.view.position.x, y: chicken.view.position.y });
          }

          // Animate newspaper wobble
          if (newspaper) {
            newspaper.rotation = Math.sin(elapsedMS * 0.003) * 0.08;
            newspaper.position.set(
              chicken.view.position.x + (chicken.getFacing() === 'left' ? -45 : 45),
              chicken.view.position.y - 55 + Math.sin(elapsedMS * 0.002) * 2
            );
          }

          // Check for "THE MOMENT"
          const inTheMoment = elapsedMS >= THE_MOMENT_START_MS && elapsedMS < RELIEF_START_MS;
          const inRelief = elapsedMS >= RELIEF_START_MS;
          const reliefProgress = inRelief ? clamp01((elapsedMS - RELIEF_START_MS) / (BUSINESS_END_MS - RELIEF_START_MS)) : 0;

          if (inTheMoment) {
            chicken.view.position.set(onPottyX, onPottyY);
            // Play fart sound at the start of THE MOMENT
            if (!fartSoundPlayed) {
              fartSoundPlayed = true;
              void audioService.playEffect('pottyFart', { volume: 0.7 });
            }
            // Frozen moment - eyes wide (simulated with pose)
            chicken.setPose({
              bodyLift: CHICKEN_IDLE_POSE.bodyLift + 24,
              bodyLean: CHICKEN_IDLE_POSE.bodyLean - 0.12,
              headPitch: -0.08,
              headBob: 0,
              headForward: 8,
              beakOpen: 0.02,
              wingPitch: 0.08,
              wingLift: 0,
              tailLift: -0.25,
              tailSplay: 0.35,
              stride: 0,
              frontFootLift: -20,
              backFootLift: -16,
            });
          } else if (inRelief) {
            chicken.view.position.set(onPottyX, onPottyY);
            // Play plop sound at the start of relief
            if (!plopSoundPlayed) {
              plopSoundPlayed = true;
              void audioService.playEffect('pottyPlop', { volume: 0.75 });
            }
            // Relief expression - head back, "ahhh" face
            chicken.setPose({
              bodyLift: lerp(24, 20, reliefProgress) + CHICKEN_IDLE_POSE.bodyLift,
              bodyLean: lerp(-0.12, 0.15, easeOutCubic(reliefProgress)),
              headPitch: lerp(-0.08, 0.4, easeOutCubic(reliefProgress)),
              headBob: lerp(0, -10, easeOutCubic(reliefProgress)),
              headForward: lerp(8, -6, reliefProgress),
              beakOpen: lerp(0.02, 0.45, easeOutCubic(reliefProgress)),
              wingPitch: lerp(0.08, -0.1, reliefProgress),
              wingLift: lerp(0, 14, easeOutCubic(reliefProgress)),
              tailLift: lerp(-0.25, 0.12, easeOutCubic(reliefProgress)),
              tailSplay: lerp(0.35, 0.6, reliefProgress),
              stride: 0,
              frontFootLift: lerp(-20, -16, reliefProgress),
              backFootLift: lerp(-16, -12, reliefProgress),
            });
            // Remove newspaper during relief
            if (reliefProgress > 0.3 && newspaper) {
              removeNewspaper();
            }
          } else {
            // Strain phase - visible vibration
            const strainProgress = clamp01((elapsedMS - CLIMB_END_MS) / (THE_MOMENT_START_MS - CLIMB_END_MS));
            const intensity = easeInQuad(strainProgress);
            const tremble = Math.sin(elapsedMS * 0.06) * intensity;
            const twitch = Math.sin(elapsedMS * 0.115) * 0.35 * intensity;
            const strain = (tremble + twitch) * 0.85;

            const jitterX = Math.sin(elapsedMS * 0.05) * 2.2 * intensity;
            const jitterY = Math.cos(elapsedMS * 0.06) * 1.6 * intensity;
            chicken.view.position.x = onPottyX + jitterX;
            chicken.view.position.y = onPottyY + jitterY;

            chicken.setPose({
              bodyLift: CHICKEN_IDLE_POSE.bodyLift + 22 + strain * 3,
              bodyLean: CHICKEN_IDLE_POSE.bodyLean - 0.1 + strain * 0.02,
              headPitch: 0.08 + strain * 0.03,
              headBob: CHICKEN_IDLE_POSE.headBob + 8 + strain * 2,
              headForward: 6,
              beakOpen: 0.08 + Math.abs(strain) * 0.1,
              wingPitch: strain * 0.15,
              wingLift: -4 + strain * 5,
              tailLift: -0.15 + strain * 0.05,
              tailSplay: 0.45,
              stride: 0,
              frontFootLift: -20,
              backFootLift: -16,
            });
          }
        }

        // ===== PHASE 6: Dismount =====
        if (elapsedMS > BUSINESS_END_MS && elapsedMS <= DISMOUNT_END_MS) {
          const dismountProgress = clamp01((elapsedMS - BUSINESS_END_MS) / CHICKEN_DISMOUNT_MS);

          if (!chickenDismounted && dismountProgress < 0.1) {
            potty?.setSeatGlow(false);
            removeNewspaper();
          }

          // Hop down
          const hopHeight = Math.sin(dismountProgress * Math.PI) * 20;
          const currentLift = (1 - easeOutCubic(dismountProgress)) * POTTY_METRICS.seatHeight * 1.1;
          chicken.view.position.y = basePosition.y - currentLift - hopHeight;
          applyShadowLift(currentLift / 65);

          // Move back toward original X
          const facing = chicken.getFacing();
          const onPottyX = pottyTargetPosition.x + (facing === 'left' ? -35 : 35);
          chicken.view.position.x = lerp(onPottyX, basePosition.x, easeOutCubic(dismountProgress));

          chicken.setPose({
            ...CHICKEN_IDLE_POSE,
            wingLift: 12 * Math.sin(dismountProgress * Math.PI),
            tailLift: CHICKEN_IDLE_POSE.tailLift + 0.15,
            beakOpen: 0.1,
          });

          if (dismountProgress >= 1) {
            chickenDismounted = true;
            chicken.view.position.set(basePosition.x, basePosition.y);
            applyShadowLift(0);
          }
        }

        // ===== PHASE 7: Admire the aftermath =====
        if (elapsedMS > DISMOUNT_END_MS && elapsedMS <= GLOAT_END_MS && potty) {
          if (!contentsRevealed) {
            contentsRevealed = true;
            potty.setContents('used');
          }

          const gloatProgress = clamp01((elapsedMS - DISMOUNT_END_MS) / POST_DISMOUNT_GLOAT_MS);
          chicken.setPose({
            ...CHICKEN_IDLE_POSE,
            headPitch: lerp(CHICKEN_IDLE_POSE.headPitch, 0.22, easeOutCubic(gloatProgress)),
            headForward: lerp(0, 6, easeOutCubic(gloatProgress)),
            beakOpen: lerp(CHICKEN_IDLE_POSE.beakOpen, 0.12, gloatProgress),
          });
        }

        // ===== PHASE 8: Flush =====
        if (elapsedMS > GLOAT_END_MS && elapsedMS <= FLUSH_END_MS && potty) {
          if (!flushStarted) {
            flushStarted = true;
            // Play flush sound
            if (!flushSoundPlayed) {
              flushSoundPlayed = true;
              void audioService.playEffect('pottyFlush', { volume: 0.8 });
            }
          }

          const flushProgress = clamp01((elapsedMS - GLOAT_END_MS) / FLUSH_DURATION_MS);

          // Handle press animation
          const pressPhase = flushProgress < 0.3
            ? easeOutCubic(flushProgress / 0.3)
            : 1 - easeOutCubic((flushProgress - 0.3) / 0.7);
          potty.setHandlePress(pressPhase);
          potty.setFlushProgress(flushProgress);

          // Chicken extends wing to flush
          const facing = chicken.getFacing();
          chicken.setPose({
            ...CHICKEN_IDLE_POSE,
            bodyLean: facing === 'left' ? 0.12 : -0.12,
            wingPitch: lerp(0, 0.6, Math.sin(flushProgress * Math.PI)),
            wingLift: lerp(0, 30, Math.sin(flushProgress * Math.PI)),
            headPitch: 0.1,
            headForward: 10,
          });
        }

        // ===== PHASE 9: Confetti celebration =====
        if (elapsedMS > FLUSH_END_MS && elapsedMS <= CONFETTI_END_MS) {
          if (!confettiSpawned) {
            spawnConfettiBurst(pottyTargetPosition);
          }

          const celebrationProgress = clamp01((elapsedMS - FLUSH_END_MS) / CONFETTI_CELEBRATION_MS);
          const bounce = Math.sin(celebrationProgress * Math.PI * 8) * 0.4;

          chicken.setPose({
            ...CHICKEN_IDLE_POSE,
            bodyLift: CHICKEN_IDLE_POSE.bodyLift - 6 * Math.abs(bounce),
            headPitch: lerp(0.1, 0.45, Math.sin(celebrationProgress * Math.PI)),
            headBob: CHICKEN_IDLE_POSE.headBob - 12 * (1 - celebrationProgress),
            beakOpen: 0.35 + Math.abs(bounce) * 0.15,
            wingLift: 25 + bounce * 12,
            tailLift: CHICKEN_IDLE_POSE.tailLift + 0.1,
          });
        }

        // ===== PHASE 10: Potty rocket exit =====
        if (elapsedMS > CONFETTI_END_MS && potty) {
          if (!rocketStarted) {
            rocketStarted = true;
          }

          const exitProgress = clamp01((elapsedMS - CONFETTI_END_MS) / POTTY_EXIT_DURATION_MS);

          // Spawn smoke particles
          if (exitProgress < 0.7 && Math.random() < 0.3) {
            spawnSmokeParticle({
              x: potty.view.position.x,
              y: potty.view.position.y + 30,
            });
          }

          // Rocket up with wobble
          const rocketHeight = easeInQuad(exitProgress) * 500;
          const wobble = Math.sin(exitProgress * Math.PI * 8) * 6 * (1 - exitProgress);
          potty.view.position.y = pottyTargetPosition.y - rocketHeight;
          potty.view.position.x = pottyTargetPosition.x + wobble;
          potty.view.rotation = wobble * 0.02;
          potty.view.alpha = 1 - exitProgress * 0.5;

          // Settle chicken pose
          chicken.setPose({
            ...CHICKEN_IDLE_POSE,
            headPitch: lerp(0.45, CHICKEN_IDLE_POSE.headPitch, exitProgress),
            headBob: lerp(-12, CHICKEN_IDLE_POSE.headBob, exitProgress),
          });

          if (!controlReleased && exitProgress > 0.5) {
            releaseBehaviorControl();
          }
        }
      },

      onExit: () => {
        releaseBehaviorControl();
        removePotty();
        cleanup();
      },
    };
  },
});
