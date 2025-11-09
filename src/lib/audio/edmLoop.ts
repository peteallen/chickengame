const hasWindow = typeof window !== 'undefined';

type AudioContextConstructor = typeof AudioContext;

type ExtendedWindow = Window & { webkitAudioContext?: AudioContextConstructor };

const getAudioContextConstructor = (): AudioContextConstructor | undefined => {
  if (!hasWindow) {
    return undefined;
  }
  const w = window as ExtendedWindow;
  return globalThis.AudioContext ?? w.webkitAudioContext;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const createNoiseBuffer = (ctx: AudioContext, duration = 0.4): AudioBuffer => {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

export type EdmLoop = {
  start: () => Promise<void>;
  stop: () => void;
  isRunning: () => boolean;
};

export const createEdmLoop = (): EdmLoop => {
  const AudioCtx = getAudioContextConstructor();
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let schedulerId: number | null = null;
  let nextNoteTime = 0;
  let stepIndex = 0;
  let bassStepIndex = 0;
  let running = false;
  let noiseBuffer: AudioBuffer | null = null;
  let bassPattern: number[] = [];

  const tempo = 132; // BPM
  const secondsPerBeat = 60 / tempo;
  const subdivision = 4; // 16th notes per beat
  const stepDuration = secondsPerBeat / subdivision;
  const scheduleAheadTime = 0.25; // seconds

  const ensureContext = (): AudioContext | null => {
    if (!AudioCtx || !hasWindow) {
      return null;
    }
    if (!context) {
      context = new AudioCtx();
      master = context.createGain();
      master.gain.value = 0.18;
      master.connect(context.destination);
      noiseBuffer = createNoiseBuffer(context);
    }
    return context;
  };

  const playKick = (time: number) => {
    if (!context || !master) {
      return;
    }
    const osc = context.createOscillator();
    osc.type = 'sine';
    const gain = context.createGain();
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.18);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.9, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + 0.3);
  };

  const playSnare = (time: number) => {
    if (!context || !master || !noiseBuffer) {
      return;
    }
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1500, time);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.45, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(time);
    source.stop(time + 0.2);
  };

  const playHat = (time: number) => {
    if (!context || !master || !noiseBuffer) {
      return;
    }
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(8000, time);
    filter.Q.setValueAtTime(6, time);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.25, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(time);
    source.stop(time + 0.08);
  };

  const playArp = (time: number) => {
    if (!context || !master) {
      return;
    }
    const osc = context.createOscillator();
    osc.type = 'sawtooth';
    const notePool = [261.63, 311.13, 349.23, 392.0, 466.16, 523.25];
    const baseNote = notePool[Math.floor(Math.random() * notePool.length)];
    const detune = 1 + Math.random() * 0.04 - 0.02;
    osc.frequency.setValueAtTime(baseNote * detune, time);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + 0.4);
  };

  const playBass = (time: number) => {
    if (!context || !master) {
      return;
    }
    const osc = context.createOscillator();
    osc.type = 'triangle';
    const bassNotes = [82.41, 98, 110, 130.81, 146.83];
    const patternIndex = bassPattern[bassStepIndex % bassPattern.length] ?? 0;
    const note = bassNotes[patternIndex % bassNotes.length];
    bassStepIndex = (bassStepIndex + 1) % bassPattern.length;
    osc.frequency.setValueAtTime(note, time);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.5, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + 0.3);
  };

  const scheduleStep = (ctx: AudioContext, time: number) => {
    if (stepIndex % 4 === 0) {
      playKick(time);
      playBass(time);
      playArp(time);
    }
    if (stepIndex % 8 === 4) {
      playSnare(time);
    }
    playHat(time);
    stepIndex = (stepIndex + 1) % 16;
  };

  const schedule = () => {
    if (!context || !running || !hasWindow) {
      return;
    }
    while (nextNoteTime < context.currentTime + scheduleAheadTime) {
      scheduleStep(context, nextNoteTime);
      nextNoteTime += stepDuration;
    }
    schedulerId = window.setTimeout(schedule, 50);
  };

  const stopScheduler = () => {
    if (!hasWindow) {
      return;
    }
    if (schedulerId !== null) {
      window.clearTimeout(schedulerId);
      schedulerId = null;
    }
  };

  const start = async () => {
    const ctx = ensureContext();
    if (!ctx || running) {
      return;
    }
    await ctx.resume();
    running = true;
    stepIndex = 0;
    bassStepIndex = 0;
    bassPattern = Array.from({ length: 8 }, () => Math.floor(Math.random() * 5));
    nextNoteTime = ctx.currentTime + 0.05;
    schedule();
  };

  const stop = () => {
    if (!running) {
      return;
    }
    running = false;
    stopScheduler();
    if (context && master) {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + 0.08);
      master.gain.linearRampToValueAtTime(0.18, now + 0.3);
    }
  };

  const isRunning = () => running;

  return { start, stop, isRunning };
};
