import { CHICKEN_IDLE_POSE, createChicken, type Chicken } from '../../entities/chicken';
import { createChickenWalkAnimator } from '../../systems/chickenWalkAnimator';
import { createChickenPeckAnimator } from '../../systems/chickenPeckAnimator';
import { createChickenFlapAnimator } from '../../systems/chickenFlapAnimator';
import type { DevEntityBlueprint, DevEntityClip } from '../types';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const createAnimatorClip = (
  id: string,
  label: string,
  factory: (chicken: Chicken) => {
    start: () => void;
    stop: () => void;
    update: (deltaMS: number) => void;
  },
  description?: string,
): DevEntityClip<Chicken> => ({
  id,
  label,
  description,
  loop: true,
  durationMS: null,
  createRuntime: (chicken) => {
    const animator = factory(chicken);
    let stopped = false;
    animator.start();
    return {
      update: (deltaMS) => animator.update(deltaMS),
      stop: () => {
        if (stopped) {
          return;
        }
        stopped = true;
        animator.stop();
      },
      isComplete: () => false,
    };
  },
});

const createSquatClip = (): DevEntityClip<Chicken> => {
  const SQUAT_IN_MS = 1400;
  const HOLD_MS = 1000;
  const STAND_MS = 900;
  const TOTAL = SQUAT_IN_MS + HOLD_MS + STAND_MS;
  return {
    id: 'chicken-squat',
    label: 'Squat & Stretch',
    description: 'Demonstrates the squat and stand poses used before laying an egg.',
    durationMS: TOTAL,
    createRuntime: (chicken) => {
      let elapsed = 0;
      chicken.resetPose();
      return {
        update: (deltaMS) => {
          elapsed = Math.min(elapsed + deltaMS, TOTAL);
          if (elapsed <= SQUAT_IN_MS) {
            const progress = easeInOutCubic(elapsed / SQUAT_IN_MS);
            const wobble = Math.sin((elapsed / 1000) * 6) * 0.05;
            chicken.setPose({
              bodyLift: CHICKEN_IDLE_POSE.bodyLift + lerp(0, 34, progress),
              bodyLean: CHICKEN_IDLE_POSE.bodyLean - 0.18 * progress + wobble,
              headPitch: CHICKEN_IDLE_POSE.headPitch + 0.5 * progress,
              headBob: CHICKEN_IDLE_POSE.headBob + lerp(0, 24, progress),
              headForward: lerp(0, 12, progress),
              beakOpen: CHICKEN_IDLE_POSE.beakOpen + progress * 0.08,
              wingPitch: -0.25 * progress,
              wingLift: -8 * progress,
              tailLift: CHICKEN_IDLE_POSE.tailLift - 0.18 * progress,
              tailSplay: CHICKEN_IDLE_POSE.tailSplay + progress * 0.08,
              stride: 0,
              frontFootLift: -12 * progress,
              backFootLift: -8 * progress,
            });
            return;
          }
          if (elapsed <= SQUAT_IN_MS + HOLD_MS) {
            const holdElapsed = elapsed - SQUAT_IN_MS;
            const holdProgress = clamp(holdElapsed / HOLD_MS, 0, 1);
            const shake = Math.sin((elapsed / 1000) * 9) * Math.pow(holdProgress, 1.2) * 0.12;
            chicken.setPose({
              bodyLift: CHICKEN_IDLE_POSE.bodyLift + 34,
              bodyLean: CHICKEN_IDLE_POSE.bodyLean - 0.2 + shake * 0.5,
              headPitch: CHICKEN_IDLE_POSE.headPitch + 0.52 + shake * 0.6,
              headBob: CHICKEN_IDLE_POSE.headBob + 24 + shake * 18,
              headForward: 12 + shake * 4,
              beakOpen: CHICKEN_IDLE_POSE.beakOpen + 0.12 + Math.max(0, shake),
              wingPitch: -0.2 + shake * 0.2,
              wingLift: -8 + shake * 6,
              tailLift: CHICKEN_IDLE_POSE.tailLift - 0.18 + shake * 0.4,
              tailSplay: CHICKEN_IDLE_POSE.tailSplay + 0.08,
              stride: 0,
              frontFootLift: -12,
              backFootLift: -8,
            });
            return;
          }
          const standElapsed = elapsed - (SQUAT_IN_MS + HOLD_MS);
          const standProgress = clamp(standElapsed / STAND_MS, 0, 1);
          const eased = easeOutBack(standProgress);
          chicken.setPose({
            bodyLift: lerp(CHICKEN_IDLE_POSE.bodyLift + 34, CHICKEN_IDLE_POSE.bodyLift, eased),
            bodyLean: lerp(CHICKEN_IDLE_POSE.bodyLean - 0.2, CHICKEN_IDLE_POSE.bodyLean, eased),
            headPitch: lerp(CHICKEN_IDLE_POSE.headPitch + 0.52, CHICKEN_IDLE_POSE.headPitch, eased),
            headBob: lerp(CHICKEN_IDLE_POSE.headBob + 24, CHICKEN_IDLE_POSE.headBob, eased),
            headForward: lerp(12, 0, eased),
            beakOpen: lerp(CHICKEN_IDLE_POSE.beakOpen + 0.1, CHICKEN_IDLE_POSE.beakOpen, eased),
            wingPitch: lerp(-0.2, 0, eased),
            wingLift: lerp(-6, 0, eased),
            tailLift: lerp(CHICKEN_IDLE_POSE.tailLift - 0.18, CHICKEN_IDLE_POSE.tailLift, eased),
            tailSplay: lerp(CHICKEN_IDLE_POSE.tailSplay + 0.08, CHICKEN_IDLE_POSE.tailSplay, eased),
            stride: lerp(0, 0.2, eased),
            frontFootLift: lerp(-6, 0, 1 - eased),
            backFootLift: lerp(-4, 0, 1 - eased),
          });
        },
        stop: () => {
          chicken.resetPose();
        },
        isComplete: () => elapsed >= TOTAL,
      };
    },
  };
};

export const chickenDevEntity: DevEntityBlueprint<Chicken> = {
  id: 'chicken',
  label: 'Chicken',
  spawn: ({ theme, stageSize }) => {
    const chicken = createChicken(theme.chicken);
    chicken.setScale(Math.min(0.9, Math.max(0.35, stageSize.width / 1400 + 0.25)));
    chicken.view.position.set(stageSize.width / 2, stageSize.height * 0.7);
    return {
      instance: chicken,
      view: chicken.view,
      destroy: () => {
        chicken.view.parent?.removeChild(chicken.view);
        chicken.view.destroy({ children: true });
      },
    };
  },
  clips: [
    createAnimatorClip('chicken-walk', 'Walk Loop', (chicken) => createChickenWalkAnimator({ chicken }), 'Loops the walk cycle.'),
    createAnimatorClip('chicken-peck', 'Peck Loop', (chicken) => createChickenPeckAnimator({ chicken }), 'Runs the ambient peck animation.'),
    createAnimatorClip('chicken-flap', 'Flap Loop', (chicken) => createChickenFlapAnimator({ chicken }), 'Flaps wings rapidly.'),
    createSquatClip(),
  ],
};
