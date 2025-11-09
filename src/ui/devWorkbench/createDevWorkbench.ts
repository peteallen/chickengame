import type { Container } from 'pixi.js';
import type { Theme } from '../../config/theme';
import {
  DEV_ENTITY_BLUEPRINTS,
  getEntityBlueprint,
  type AnyDevEntityBlueprint,
  type ClipRuntime,
  type DevEntityHandle,
  type DevStageSize,
} from '../../devtools';
import './devWorkbench.css';

export type DevWorkbench = {
  update: (deltaMS: number) => void;
  layout: (size: DevStageSize) => void;
  destroy: () => void;
};

export const createDevWorkbench = (options: {
  layer: Container;
  root: HTMLElement;
  theme: Theme;
  initialSize: DevStageSize;
}): DevWorkbench => {
  const { layer, root, theme } = options;
  let stageSize: DevStageSize = options.initialSize;

  const panel = document.createElement('section');
  panel.className = 'dev-workbench';

  const header = document.createElement('div');
  header.className = 'dev-workbench__header';
  header.textContent = 'Developer Workbench';

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'dev-workbench__toggle';
  toggleButton.textContent = 'Hide';

  const body = document.createElement('div');
  body.className = 'dev-workbench__body';

  const controls = document.createElement('div');
  controls.className = 'dev-workbench__controls';

  const entityLabel = document.createElement('label');
  entityLabel.textContent = 'Entity';
  const entitySelect = document.createElement('select');
  entityLabel.appendChild(entitySelect);

  const clipLabel = document.createElement('label');
  clipLabel.textContent = 'Animation';
  const clipSelect = document.createElement('select');
  clipLabel.appendChild(clipSelect);

  controls.append(entityLabel, clipLabel);

  const actions = document.createElement('div');
  actions.className = 'dev-workbench__actions';
  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.textContent = 'Play';
  const stopButton = document.createElement('button');
  stopButton.type = 'button';
  stopButton.textContent = 'Stop';
  const statusLabel = document.createElement('span');
  statusLabel.className = 'dev-workbench__status';
  statusLabel.textContent = 'Idle';
  actions.append(playButton, stopButton, statusLabel);

  const description = document.createElement('p');
  description.className = 'dev-workbench__description';
  description.textContent = 'Select an entity and animation to preview.';

  body.append(controls, actions, description);
  header.appendChild(toggleButton);
  panel.append(header, body);
  root.appendChild(panel);

  let collapsed = false;
  toggleButton.addEventListener('click', () => {
    collapsed = !collapsed;
    panel.classList.toggle('dev-workbench--collapsed', collapsed);
    toggleButton.textContent = collapsed ? 'Show' : 'Hide';
  });

  let currentBlueprint: AnyDevEntityBlueprint | null = DEV_ENTITY_BLUEPRINTS[0] ?? null;
  let entityHandle: DevEntityHandle<unknown> | null = null;
  let clipRuntime: ClipRuntime | null = null;
  let activeClipId: string | null = currentBlueprint?.clips[0]?.id ?? null;

  const setStatus = (text: string) => {
    statusLabel.textContent = text;
  };

  const stopClip = () => {
    if (clipRuntime) {
      clipRuntime.stop();
      clipRuntime = null;
    }
    setStatus('Idle');
    updateButtons();
  };

  const removeEntity = () => {
    stopClip();
    if (entityHandle) {
      layer.removeChild(entityHandle.view);
      entityHandle.destroy();
      entityHandle = null;
    }
    layer.removeChildren();
  };

  const updateDescription = () => {
    if (!currentBlueprint || !activeClipId) {
      description.textContent = 'No animation selected.';
      return;
    }
    const clip = currentBlueprint.clips.find((item) => item.id === activeClipId);
    if (!clip) {
      description.textContent = 'No animation selected.';
      return;
    }
    const durationText = clip.durationMS ? `${clip.durationMS} ms` : clip.loop ? 'Loops' : 'Single run';
    description.textContent = `${clip.description ?? clip.label} (${durationText})`;
  };

  const updateButtons = () => {
    playButton.disabled = !activeClipId;
    stopButton.disabled = !clipRuntime;
  };

  const populateClipOptions = () => {
    clipSelect.innerHTML = '';
    if (!currentBlueprint || currentBlueprint.clips.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No clips available';
      option.value = '';
      clipSelect.appendChild(option);
      clipSelect.disabled = true;
      activeClipId = null;
      updateDescription();
      updateButtons();
      return;
    }
    clipSelect.disabled = false;
    currentBlueprint.clips.forEach((clip) => {
      const option = document.createElement('option');
      option.value = clip.id;
      option.textContent = clip.label;
      clipSelect.appendChild(option);
    });
    if (!activeClipId || !currentBlueprint.clips.some((clip) => clip.id === activeClipId)) {
      activeClipId = currentBlueprint.clips[0]?.id ?? null;
    }
    if (activeClipId) {
      clipSelect.value = activeClipId;
    }
    updateDescription();
    updateButtons();
  };

  const spawnEntityById = (
    blueprintId: string,
    options?: { resumeClipId?: string | null; autoPlay?: boolean },
  ) => {
    const blueprint = getEntityBlueprint(blueprintId);
    if (!blueprint) {
      return;
    }
    currentBlueprint = blueprint;
    removeEntity();
    entityHandle = blueprint.spawn({ theme, stageSize });
    layer.removeChildren();
    layer.addChild(entityHandle.view);
    activeClipId = options?.resumeClipId ?? blueprint.clips[0]?.id ?? null;
    populateClipOptions();
    if (options?.autoPlay && activeClipId) {
      playClip(activeClipId);
    } else {
      stopClip();
    }
  };

  const playClip = (clipId?: string | null) => {
    if (!entityHandle || !currentBlueprint) {
      return;
    }
    const targetClipId = clipId ?? activeClipId;
    if (!targetClipId) {
      return;
    }
    const clip = currentBlueprint.clips.find((item) => item.id === targetClipId);
    if (!clip) {
      return;
    }
    stopClip();
    activeClipId = clip.id;
    clipSelect.value = clip.id;
    clipRuntime = clip.createRuntime(entityHandle.instance);
    setStatus(`Playing: ${clip.label}`);
    updateDescription();
    updateButtons();
  };

  playButton.addEventListener('click', () => {
    playClip();
  });

  stopButton.addEventListener('click', () => {
    stopClip();
  });

  entitySelect.addEventListener('change', () => {
    spawnEntityById(entitySelect.value);
  });

  clipSelect.addEventListener('change', () => {
    activeClipId = clipSelect.value || null;
    stopClip();
    updateDescription();
    updateButtons();
  });

  DEV_ENTITY_BLUEPRINTS.forEach((blueprint) => {
    const option = document.createElement('option');
    option.value = blueprint.id;
    option.textContent = blueprint.label;
    entitySelect.appendChild(option);
  });

  if (currentBlueprint) {
    entitySelect.value = currentBlueprint.id;
  }

  populateClipOptions();
  if (currentBlueprint) {
    spawnEntityById(currentBlueprint.id);
  }

  const update = (deltaMS: number) => {
    entityHandle?.update?.(deltaMS);
    if (clipRuntime) {
      clipRuntime.update(deltaMS);
      if (clipRuntime.isComplete()) {
        clipRuntime.stop();
        clipRuntime = null;
        setStatus('Complete');
        updateButtons();
      }
    }
  };

  const layout = (size: DevStageSize) => {
    stageSize = size;
    if (currentBlueprint) {
      const resumeClipId = clipRuntime ? activeClipId : null;
      const autoPlay = Boolean(clipRuntime);
      spawnEntityById(currentBlueprint.id, { resumeClipId, autoPlay });
    }
  };

  const destroy = () => {
    stopClip();
    removeEntity();
    panel.remove();
  };

  layer.visible = true;

  return { update, layout, destroy };
};
