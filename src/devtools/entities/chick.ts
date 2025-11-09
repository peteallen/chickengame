import { createChick, CHICK_IDLE_POSE, type Chick } from '../../entities/chick';
import type { DevEntityBlueprint, DevEntityClip } from '../types';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const createHopClip = (): DevEntityClip<Chick> => ({
  id: 'chick-hop',
  label: 'Hop Loop',
  description: 'Simple hop cycle with wing flutters.',
  loop: true,
  durationMS: null,
  createRuntime: (chick) => {
    let elapsed = 0;
    return {
      update: (deltaMS) => {
        elapsed += deltaMS;
        const phase = (elapsed / 1000) * 2.2 * Math.PI;
        const stride = Math.sin(phase) * 0.85;
        const hop = Math.max(0, Math.sin(phase * 2)) * 9;
        chick.setPose({
          stride,
          hop,
          wingLift: Math.sin(phase * 2.1) * 0.45,
          wingSpread: Math.sin(phase * 0.6) * 0.4,
          headTilt: Math.sin(phase * 0.4) * 0.3,
          headBob: CHICK_IDLE_POSE.headBob + Math.sin(phase * 0.8) * 6,
          beakOpen: Math.max(0, Math.sin(phase)) * 0.12,
          tailLift: Math.sin(phase * 1.6) * 0.12,
        });
      },
      stop: () => {
        chick.resetPose();
      },
      isComplete: () => false,
    };
  },
});

const createStretchClip = (): DevEntityClip<Chick> => ({
  id: 'chick-stretch',
  label: 'Wing Stretch',
  description: 'One-shot stretch that ends back at idle.',
  durationMS: 1800,
  loop: false,
  createRuntime: (chick) => {
    let elapsed = 0;
    chick.resetPose();
    return {
      update: (deltaMS) => {
        elapsed = Math.min(elapsed + deltaMS, 1800);
        const t = elapsed / 1800;
        const lift = Math.sin(t * Math.PI);
        chick.setPose({
          wingSpread: lift,
          wingLift: lift * 0.8,
          headForward: lift * 6,
          bodyLean: CHICK_IDLE_POSE.bodyLean + lift * 0.25,
          tailLift: CHICK_IDLE_POSE.tailLift + lift * 0.2,
        });
      },
      stop: () => {
        chick.resetPose();
      },
      isComplete: () => elapsed >= 1800,
    };
  },
});

export const chickDevEntity: DevEntityBlueprint<Chick> = {
  id: 'chick',
  label: 'Chick',
  spawn: ({ theme, stageSize }) => {
    const chick = createChick(theme.chick);
    chick.setScale(Math.min(1, Math.max(0.4, stageSize.width / 1500 + 0.2)));
    chick.view.position.set(stageSize.width / 2, stageSize.height * 0.72);
    return {
      instance: chick,
      view: chick.view,
      destroy: () => {
        chick.view.parent?.removeChild(chick.view);
        chick.view.destroy({ children: true });
      },
    };
  },
  clips: [createHopClip(), createStretchClip()],
};
