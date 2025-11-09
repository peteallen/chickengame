import { Container, Graphics, Point } from 'pixi.js';
import type { ChickenActionDefinition } from '../chickenActionSystem';
import { CHICKEN_IDLE_POSE } from '../../entities/chicken';
import type { BehaviorControlHandle } from './behaviorControl';
import type { SoundPlaybackHandle } from '../../lib/audio/soundEffect';

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const easeInQuad = (t: number) => {
  const clamped = clamp(t);
  return clamped * clamped;
};
const easeOutQuad = (t: number) => {
  const clamped = clamp(t);
  return 1 - (1 - clamped) * (1 - clamped);
};
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

const PREPARE_DURATION_MS = 900;
const STREAM_DURATION_MS = 3200;
const MEGA_GROW_DURATION_MS = 1600;
const FLOAT_DURATION_MS = 2600;
const BURST_DURATION_MS = 1100;
const SETTLE_DURATION_MS = 500;

const PREPARE_END_MS = PREPARE_DURATION_MS;
const STREAM_END_MS = PREPARE_END_MS + STREAM_DURATION_MS;
const MEGA_GROW_END_MS = STREAM_END_MS + MEGA_GROW_DURATION_MS;
const FLOAT_END_MS = MEGA_GROW_END_MS + FLOAT_DURATION_MS;
const BURST_END_MS = FLOAT_END_MS + BURST_DURATION_MS;
const ACTION_DURATION_MS = BURST_END_MS + SETTLE_DURATION_MS;

type FloatingBubble = {
  view: Container;
  basePosition: { x: number; y: number };
  velocity: { x: number; y: number };
  swayPhase: number;
  swaySpeed: number;
  swayRadius: number;
  life: number;
  maxLife: number;
};

type MegaBubbleView = {
  view: Container;
  baseRadius: number;
};

const createBubbleGraphic = (radius: number): Container => {
  const container = new Container();
  container.eventMode = 'none';

  const shell = new Graphics();
  shell
    .circle(0, 0, radius)
    .fill({ color: 0xffffff, alpha: 0.12 })
    .stroke({ color: 0xaedbff, width: Math.max(2, radius * 0.14), alpha: 0.4 });

  const highlight = new Graphics();
  highlight
    .ellipse(-radius * 0.4, -radius * 0.35, radius * 0.3, radius * 0.18)
    .fill({ color: 0xffffff, alpha: 0.4 });
  highlight.rotation = -0.55;

  container.addChild(shell, highlight);
  container.alpha = 0;
  container.pivot.set(0, 0);
  return container;
};

const createMegaBubbleView = (): MegaBubbleView => {
  const baseRadius = 120;
  return {
    view: createBubbleGraphic(baseRadius),
    baseRadius,
  };
};

const updateBubbleAlpha = (bubble: FloatingBubble) => {
  const fadeIn = 220;
  const fadeOutStart = bubble.maxLife * 0.7;
  if (bubble.life < fadeIn) {
    bubble.view.alpha = clamp(bubble.life / fadeIn);
  } else if (bubble.life > fadeOutStart) {
    const fadeOutDuration = Math.max(1, bubble.maxLife - fadeOutStart);
    const progress = clamp((bubble.life - fadeOutStart) / fadeOutDuration);
    bubble.view.alpha = 1 - progress;
  } else {
    bubble.view.alpha = 1;
  }
};

export const createBubbleBlowingAction = (): ChickenActionDefinition => ({
  id: 'bubble-blowing',
  weight: 1.1,
  create: (context) => {
    const {
      chicken,
      environmentScene,
      behaviorControls,
      penBoundsService,
      audioService,
    } = context;
    const penLayer = environmentScene.penLayer;

    const bubbleLayer = new Container();
    bubbleLayer.sortableChildren = true;
    bubbleLayer.eventMode = 'none';

    const tipLocalPoint = new Point(chicken.metrics.beak.length + 6, -2);
    const sharedPointA = new Point();
    const sharedPointB = new Point();

    const getBeakTipPosition = () => {
      const global = chicken.parts.beak.toGlobal(tipLocalPoint, sharedPointA);
      const local = penLayer.toLocal(global, undefined, sharedPointB);
      return { x: local.x, y: local.y };
    };

    const basePosition = { x: chicken.view.position.x, y: chicken.view.position.y };
    const baseShadowScale = {
      x: chicken.parts.shadow.scale.x,
      y: chicken.parts.shadow.scale.y,
    };
    const baseShadowAlpha = chicken.parts.shadow.alpha;

    const penSnapshot = penBoundsService.getSnapshot();
    const penTopY = penSnapshot?.bounds.footprint.minY ?? basePosition.y - 280;
    const availableLift = Math.max(80, basePosition.y - (penTopY + 24));
    const scaledLift = Math.abs(chicken.view.scale.y) * 320;
    const maxLift = Math.max(140, Math.min(availableLift, scaledLift));
    const floatCeilingY = penTopY - 40;

    const bubbleCenterOffset = {
      x: 0,
      y: -Math.abs(chicken.view.scale.y) * (chicken.metrics.body.height * 0.35 + 26),
    };

    const megaBubbleTargetRadius = Math.max(
      140,
      Math.abs(chicken.view.scale.y) * (chicken.metrics.body.height + 120),
    );

    let behaviorHandle: BehaviorControlHandle | null = null;
    let burstSound: SoundPlaybackHandle | null = null;
    let currentLift = 0;
    let liftAtBurstStart = 0;
    let timeToNextBubble = 0;
    let megaBubble: MegaBubbleView | null = null;
    let megaBubbleRadius = 0;
    let megaBubbleState: 'idle' | 'growing' | 'floating' | 'bursting' | 'done' = 'idle';
    let burstTriggered = false;

    const bubbles: FloatingBubble[] = [];

    const applyShadowLiftEffect = (ratio: number) => {
      const clamped = clamp(ratio);
      const shadow = chicken.parts.shadow;
      shadow.scale.set(
        lerp(baseShadowScale.x, baseShadowScale.x * 0.6, clamped),
        lerp(baseShadowScale.y, baseShadowScale.y * 0.5, clamped),
      );
      shadow.alpha = lerp(baseShadowAlpha, baseShadowAlpha * 0.4, clamped);
    };

    const setLiftHeight = (height: number) => {
      currentLift = Math.max(0, Math.min(height, maxLift));
      chicken.view.position.y = basePosition.y - currentLift;
      applyShadowLiftEffect(currentLift / maxLift);
    };

    const ensureMegaBubble = () => {
      if (megaBubble) {
        return;
      }
      megaBubble = createMegaBubbleView();
      megaBubble.view.zIndex = 1.2;
      bubbleLayer.addChild(megaBubble.view);
    };

    const updateMegaBubbleRadius = (radius: number) => {
      if (!megaBubble) {
        return;
      }
      const clamped = Math.max(16, radius);
      megaBubbleRadius = clamped;
      const scale = clamped / megaBubble.baseRadius;
      megaBubble.view.scale.set(scale);
      megaBubble.view.alpha = Math.min(0.96, Math.max(megaBubble.view.alpha, clamped / megaBubbleTargetRadius));
    };

    const updateMegaBubblePosition = () => {
      if (!megaBubble) {
        return;
      }
      megaBubble.view.position.set(
        chicken.view.position.x + bubbleCenterOffset.x,
        chicken.view.position.y + bubbleCenterOffset.y,
      );
    };

    const destroyMegaBubble = () => {
      if (!megaBubble) {
        return;
      }
      megaBubble.view.parent?.removeChild(megaBubble.view);
      megaBubble.view.destroy({ children: true });
      megaBubble = null;
      megaBubbleRadius = 0;
    };

    const spawnFloatingBubble = (options?: {
      radius?: number;
      position?: { x: number; y: number };
      velocity?: { x: number; y: number };
      maxLife?: number;
    }) => {
      const radius = options?.radius ?? randomRange(12, 34);
      const view = createBubbleGraphic(radius);
      view.alpha = 0;
      view.zIndex = 2;
      const origin = options?.position ?? getBeakTipPosition();
      const bubble: FloatingBubble = {
        view,
        basePosition: { x: origin.x, y: origin.y },
        velocity: options?.velocity ?? {
          x: randomRange(-0.045, 0.045),
          y: randomRange(-0.12, -0.08),
        },
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: randomRange(0.0012, 0.0019),
        swayRadius: randomRange(4, 14),
        life: 0,
        maxLife: options?.maxLife ?? randomRange(2400, 4200),
      };
      bubbleLayer.addChild(bubble.view);
      bubbles.push(bubble);
      return bubble;
    };

    const emitBurstResidue = () => {
      const center = {
        x: chicken.view.position.x,
        y: chicken.view.position.y + bubbleCenterOffset.y,
      };
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.2;
        const speed = randomRange(0.08, 0.16);
        spawnFloatingBubble({
          radius: randomRange(10, 24),
          position: {
            x: center.x + Math.cos(angle) * randomRange(6, 18),
            y: center.y + Math.sin(angle) * randomRange(6, 18),
          },
          velocity: {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed - 0.05,
          },
          maxLife: randomRange(1000, 1600),
        });
      }
    };

    const removeBubble = (bubble: FloatingBubble) => {
      bubble.view.parent?.removeChild(bubble.view);
      bubble.view.destroy({ children: true });
    };

    const updateBubbles = (deltaMS: number) => {
      for (let i = bubbles.length - 1; i >= 0; i -= 1) {
        const bubble = bubbles[i];
        bubble.life += deltaMS;
        bubble.basePosition.x += bubble.velocity.x * deltaMS;
        bubble.basePosition.y += bubble.velocity.y * deltaMS;
        bubble.swayPhase += bubble.swaySpeed * deltaMS;
        const sway = Math.sin(bubble.swayPhase) * bubble.swayRadius;
        bubble.view.position.set(bubble.basePosition.x + sway, bubble.basePosition.y);
        updateBubbleAlpha(bubble);
        if (
          bubble.life >= bubble.maxLife ||
          bubble.basePosition.y <= floatCeilingY ||
          bubble.view.alpha <= 0.01
        ) {
          removeBubble(bubble);
          bubbles.splice(i, 1);
        }
      }
    };

    const updatePoseForBlowing = (progress: number) => {
      const poseIntensity = easeOutCubic(clamp(progress));
      chicken.setPose({
        bodyLean: lerp(CHICKEN_IDLE_POSE.bodyLean, 0.18, poseIntensity),
        bodyLift: lerp(CHICKEN_IDLE_POSE.bodyLift, -10, poseIntensity),
        headPitch: lerp(CHICKEN_IDLE_POSE.headPitch, -0.32, poseIntensity),
        headForward: lerp(CHICKEN_IDLE_POSE.headForward, 30, poseIntensity),
        headBob: lerp(CHICKEN_IDLE_POSE.headBob, -8, poseIntensity),
        beakOpen: lerp(CHICKEN_IDLE_POSE.beakOpen, 0.62, poseIntensity),
        wingPitch: lerp(CHICKEN_IDLE_POSE.wingPitch, 0.3, poseIntensity),
        wingLift: lerp(CHICKEN_IDLE_POSE.wingLift, 0.15, poseIntensity),
        tailSplay: lerp(CHICKEN_IDLE_POSE.tailSplay, 0.2, poseIntensity),
        stride: lerp(CHICKEN_IDLE_POSE.stride, -0.2, poseIntensity),
        frontFootLift: lerp(CHICKEN_IDLE_POSE.frontFootLift, -6, poseIntensity),
        backFootLift: lerp(CHICKEN_IDLE_POSE.backFootLift, 4, poseIntensity),
      });
    };

    const updatePoseForFloat = (progress: number) => {
      const poseIntensity = clamp(progress);
      chicken.setPose({
        bodyLean: lerp(0.08, -0.05, poseIntensity),
        headPitch: lerp(-0.28, -0.12, poseIntensity),
        headForward: lerp(24, 6, poseIntensity),
        beakOpen: lerp(0.6, 0.25, poseIntensity),
        wingLift: lerp(0.14, 0.42, poseIntensity),
        wingPitch: lerp(0.18, -0.15, poseIntensity),
        tailLift: lerp(0.05, 0.25, poseIntensity),
        tailSplay: lerp(0.2, 0.5, poseIntensity),
        frontFootLift: lerp(-2, -22, poseIntensity),
        backFootLift: lerp(2, -18, poseIntensity),
      });
    };

    const startBurst = () => {
      if (burstTriggered) {
        return;
      }
      burstTriggered = true;
      megaBubbleState = 'bursting';
      liftAtBurstStart = currentLift;
      burstSound = audioService.playEffect('bubbleBurst', { volume: 0.92 });
      emitBurstResidue();
    };

    const cleanup = () => {
      setLiftHeight(0);
      chicken.view.position.set(basePosition.x, basePosition.y);
      chicken.resetPose();
      applyShadowLiftEffect(0);
      behaviorHandle?.release();
      behaviorHandle = null;
      burstSound?.stop();
      burstSound = null;
      bubbles.splice(0).forEach((bubble) => removeBubble(bubble));
      destroyMegaBubble();
      bubbleLayer.removeFromParent();
      bubbleLayer.destroy({ children: true });
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
        bubbleLayer.zIndex = chicken.view.zIndex + 0.6;
        penLayer.addChild(bubbleLayer);
        chicken.resetPose();
        updatePoseForBlowing(0);
        timeToNextBubble = 300;
      },
      onUpdate: (deltaMS, elapsedMS) => {
        if (elapsedMS <= PREPARE_END_MS) {
          const progress = easeOutCubic(elapsedMS / PREPARE_DURATION_MS);
          updatePoseForBlowing(progress);
        } else if (elapsedMS <= STREAM_END_MS) {
          updatePoseForBlowing(1);
          timeToNextBubble -= deltaMS;
          if (timeToNextBubble <= 0) {
            spawnFloatingBubble();
            timeToNextBubble = randomRange(120, 320);
          }
        } else if (elapsedMS <= MEGA_GROW_END_MS) {
          ensureMegaBubble();
          megaBubbleState = 'growing';
          const growthProgress = (elapsedMS - STREAM_END_MS) / MEGA_GROW_DURATION_MS;
          const eased = easeOutCubic(growthProgress);
          updatePoseForBlowing(1 - eased * 0.2);
          updateMegaBubbleRadius(lerp(44, megaBubbleTargetRadius, eased));
          updateMegaBubblePosition();
        } else if (elapsedMS <= FLOAT_END_MS) {
          ensureMegaBubble();
          if (megaBubbleState !== 'floating') {
            megaBubbleState = 'floating';
          }
          const floatProgress = (elapsedMS - MEGA_GROW_END_MS) / FLOAT_DURATION_MS;
          const easedFloat = easeInOutSine(floatProgress);
          updatePoseForFloat(easedFloat);
          const bob = Math.sin(elapsedMS * 0.0024) * 6;
          const targetRadius = megaBubbleTargetRadius * (1 + Math.sin(elapsedMS * 0.0018) * 0.04);
          updateMegaBubbleRadius(lerp(megaBubbleRadius, targetRadius, 0.12));
          updateMegaBubblePosition();
          setLiftHeight(maxLift * easedFloat + bob);
        } else if (elapsedMS <= BURST_END_MS) {
          if (!burstTriggered) {
            startBurst();
          }
          const burstProgress = (elapsedMS - FLOAT_END_MS) / BURST_DURATION_MS;
          const easedDrop = easeInQuad(burstProgress);
          const height = liftAtBurstStart * (1 - easedDrop);
          setLiftHeight(height);
          updatePoseForFloat(1 - burstProgress * 0.6);
          if (megaBubble && megaBubbleState !== 'done') {
            const scaleBoost = lerp(1, 1.3, easeOutQuad(burstProgress));
            const alpha = clamp(1 - easeOutQuad(burstProgress));
            megaBubble.view.alpha = alpha;
            megaBubble.view.scale.set((megaBubbleRadius / megaBubble.baseRadius) * scaleBoost);
            updateMegaBubblePosition();
            if (burstProgress >= 1) {
              megaBubbleState = 'done';
              destroyMegaBubble();
            }
          }
        } else {
          setLiftHeight(0);
          updatePoseForFloat(0);
        }

        updateBubbles(deltaMS);
      },
      onExit: cleanup,
    };
  },
});

