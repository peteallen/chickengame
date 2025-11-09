import type { ChickenActionDefinition } from '../chickenActionSystem';

const DISCO_DURATION_MS = 5000;
const DISCO_TEMPO = 132; // BPM for pulse sync

export const createDiscoPartyAction = (): ChickenActionDefinition => ({
  id: 'disco-party',
  weight: 1,
  create: (context) => {
    const { behaviorSystem, flapAnimator, overlays, audio } = context;
    const rig = overlays.discoRig;
    const edmLoop = audio.edmLoop;
    const beatDurationMS = 60000 / DISCO_TEMPO;

    return {
      durationMS: DISCO_DURATION_MS,
      onEnter: () => {
        behaviorSystem.setAnimatorAuthority('external');
        behaviorSystem.setStateLock('walk');
        behaviorSystem.setSpeedMultiplier(2);
        rig.setEnabled(true);
        rig.setPulseStrength(0);
        flapAnimator.start();
        void edmLoop.start();
      },
      onUpdate: (_, elapsedMS) => {
        const beatPhase = (elapsedMS % beatDurationMS) / beatDurationMS;
        const pulse = Math.pow(Math.sin(Math.PI * beatPhase), 2);
        rig.setPulseStrength(pulse);
      },
      onExit: () => {
        rig.setEnabled(false);
        rig.setPulseStrength(0);
        edmLoop.stop();
        flapAnimator.stop();
        behaviorSystem.setSpeedMultiplier(1);
        behaviorSystem.setStateLock(null);
        behaviorSystem.setAnimatorAuthority('system');
      },
    };
  },
});
