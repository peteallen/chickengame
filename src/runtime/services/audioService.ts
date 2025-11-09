import { createEdmLoop, type EdmLoop } from '../../lib/audio/edmLoop';

export type AudioLoopKey = 'edm';

export type AudioService = {
  playLoop: (key: AudioLoopKey) => Promise<void>;
  stopLoop: (key: AudioLoopKey) => void;
  getLoop: (key: AudioLoopKey) => EdmLoop | undefined;
  stopAll: () => void;
  destroy: () => void;
};

export const createAudioService = (): AudioService => {
  const loops = new Map<AudioLoopKey, EdmLoop>([['edm', createEdmLoop()]]);

  const getLoop = (key: AudioLoopKey) => loops.get(key);

  const playLoop = async (key: AudioLoopKey) => {
    const loop = loops.get(key);
    if (!loop) {
      return;
    }
    await loop.start();
  };

  const stopLoop = (key: AudioLoopKey) => {
    loops.get(key)?.stop();
  };

  const stopAll = () => {
    loops.forEach((loop) => loop.stop());
  };

  const destroy = () => {
    stopAll();
    loops.clear();
  };

  return { playLoop, stopLoop, getLoop, stopAll, destroy };
};
