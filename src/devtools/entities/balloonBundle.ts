import { createBalloonBundle, type BalloonBundle } from '../../entities/balloonBundle';
import type { DevEntityBlueprint, DevEntityClip } from '../types';

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

const createLiftClip = (): DevEntityClip<BalloonBundle> => {
  const DURATION = 5200;
  const ASCEND_END = 1800;
  const RELEASE_START = 3400;
  return {
    id: 'balloon-lift-cycle',
    label: 'Lift Cycle',
    description: 'Grab, lift, hover, then release the bundle.',
    durationMS: DURATION,
    loop: false,
    createRuntime: (bundle) => {
      let elapsed = 0;
      bundle.setGrabProgress(0);
      bundle.setLiftOffset({ x: 0, y: 0 });
      bundle.setReleaseProgress(0);
      return {
        update: (deltaMS) => {
          elapsed = Math.min(elapsed + deltaMS, DURATION);
          const liftProgress = easeOutCubic(Math.min(elapsed, ASCEND_END) / ASCEND_END);
          const hoverWave = Math.sin(elapsed * 0.004) * 8;
          bundle.setGrabProgress(liftProgress);
          bundle.setLiftOffset({
            x: Math.sin(elapsed * 0.0025) * 18,
            y: -liftProgress * 90 - hoverWave,
          });
          if (elapsed >= RELEASE_START) {
            const release = clamp((elapsed - RELEASE_START) / (DURATION - RELEASE_START));
            bundle.setReleaseProgress(release);
          }
        },
        stop: () => {
          bundle.setGrabProgress(0);
          bundle.setReleaseProgress(0);
          bundle.setLiftOffset({ x: 0, y: 0 });
        },
        isComplete: () => elapsed >= DURATION,
      };
    },
  };
};

const createIdleClip = (): DevEntityClip<BalloonBundle> => ({
  id: 'balloon-idle',
  label: 'Idle Drift',
  description: 'Keeps a subtle sway going forever.',
  loop: true,
  durationMS: null,
  createRuntime: (bundle) => {
    let elapsed = 0;
    bundle.setReleaseProgress(0);
    bundle.setGrabProgress(0.4);
    return {
      update: (deltaMS) => {
        elapsed += deltaMS;
        bundle.setLiftOffset({
          x: Math.sin(elapsed * 0.002) * 12,
          y: Math.cos(elapsed * 0.0015) * -10,
        });
      },
      stop: () => {
        bundle.setLiftOffset({ x: 0, y: 0 });
        bundle.setGrabProgress(0);
      },
      isComplete: () => false,
    };
  },
});

export const balloonBundleDevEntity: DevEntityBlueprint<BalloonBundle> = {
  id: 'balloon-bundle',
  label: 'Balloon Bundle',
  spawn: ({ theme, stageSize }) => {
    const bundle = createBalloonBundle({ theme });
    bundle.view.position.set(stageSize.width / 2, stageSize.height * 0.35);
    return {
      instance: bundle,
      view: bundle.view,
      update: (deltaMS) => bundle.update(deltaMS),
      destroy: () => {
        bundle.view.parent?.removeChild(bundle.view);
        bundle.destroy();
      },
    };
  },
  clips: [createIdleClip(), createLiftClip()],
};
