import type { Container } from 'pixi.js';
import type { Theme } from '../config/theme';

export type DevStageSize = {
  width: number;
  height: number;
};

export type DevEntitySpawnOptions = {
  theme: Theme;
  stageSize: DevStageSize;
};

export type ClipRuntime = {
  update: (deltaMS: number) => void;
  stop: () => void;
  isComplete: () => boolean;
};

export type DevEntityClip<TInstance> = {
  id: string;
  label: string;
  description?: string;
  durationMS?: number | null;
  loop?: boolean;
  createRuntime: (instance: TInstance) => ClipRuntime;
};

export type DevEntityHandle<TInstance> = {
  instance: TInstance;
  view: Container;
  update?: (deltaMS: number) => void;
  destroy: () => void;
};

export type DevEntityBlueprint<TInstance> = {
  id: string;
  label: string;
  spawn: (options: DevEntitySpawnOptions) => DevEntityHandle<TInstance>;
  clips: DevEntityClip<TInstance>[];
};

export type AnyDevEntityBlueprint = DevEntityBlueprint<any>;
