import type { ChickenActionDefinition } from '../chickenActionSystem';
import type { BehaviorControlHandle } from './behaviorControl';

const DISCO_DURATION_MS = 5000;
const DISCO_TEMPO = 132; // BPM for pulse sync

export const createDiscoPartyAction = (): ChickenActionDefinition => ({
  id: 'disco-party',
  weight: 1,
  create: (context) => {
    const { flapAnimator, overlays, audioService, behaviorControls } = context;
    const rig = overlays.discoRig;
    const beatDurationMS = 60000 / DISCO_TEMPO;
    let behaviorHandle: BehaviorControlHandle | null = null;

    return {
      durationMS: DISCO_DURATION_MS,
      onEnter: () => {
        behaviorHandle = behaviorControls.takeover({
          animatorAuthority: 'external',
          stateLock: 'walk',
          speedMultiplier: 2,
        });
        rig.setEnabled(true);
        rig.setPulseStrength(0);
        flapAnimator.start();
        void audioService.playLoop('edm');
      },
      onUpdate: (_, elapsedMS) => {
        const beatPhase = (elapsedMS % beatDurationMS) / beatDurationMS;
        const pulse = Math.pow(Math.sin(Math.PI * beatPhase), 2);
        rig.setPulseStrength(pulse);
      },
      onExit: () => {
        rig.setEnabled(false);
        rig.setPulseStrength(0);
        audioService.stopLoop('edm');
        flapAnimator.stop();
        behaviorHandle?.release();
        behaviorHandle = null;
      },
    };
  },
});
