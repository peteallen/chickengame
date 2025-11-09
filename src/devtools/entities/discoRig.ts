import { createDiscoRig, type DiscoRig } from '../../entities/discoRig';
import type { DevEntityBlueprint, DevEntityClip } from '../types';

const createPulseClip = (): DevEntityClip<DiscoRig> => ({
  id: 'disco-pulse',
  label: 'Pulse Loop',
  description: 'Enables the rig and runs a beat-synced pulse.',
  loop: true,
  durationMS: null,
  createRuntime: (rig) => {
    let elapsed = 0;
    rig.setEnabled(true);
    rig.setPulseStrength(0);
    return {
      update: (deltaMS) => {
        elapsed += deltaMS;
        const beatDuration = 60000 / 132;
        const beatPhase = ((elapsed % beatDuration) / beatDuration) || 0;
        const pulse = Math.pow(Math.sin(Math.PI * beatPhase), 2);
        rig.setPulseStrength(pulse);
      },
      stop: () => {
        rig.setPulseStrength(0);
        rig.setEnabled(false);
      },
      isComplete: () => false,
    };
  },
});

export const discoRigDevEntity: DevEntityBlueprint<DiscoRig> = {
  id: 'disco-rig',
  label: 'Disco Light Bar',
  spawn: ({ stageSize }) => {
    const rig = createDiscoRig();
    rig.view.position.set(0, 0);
    rig.layout(stageSize);
    return {
      instance: rig,
      view: rig.view,
      update: (deltaMS) => rig.update(deltaMS),
      destroy: () => {
        rig.view.parent?.removeChild(rig.view);
        rig.destroy();
      },
    };
  },
  clips: [createPulseClip()],
};
