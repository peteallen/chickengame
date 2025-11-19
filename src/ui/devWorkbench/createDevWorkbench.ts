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

type DevWorkbenchActionOption = {
  id: string;
  label: string;
  isAvailable: () => boolean;
};

type DevWorkbenchActionControls = {
  trigger: (actionId: string) => boolean;
  isActive: () => boolean;
  getActiveId: () => string | null;
};

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
  actions: DevWorkbenchActionOption[];
  actionControls: DevWorkbenchActionControls;
}): DevWorkbench => {
  const { layer, root, theme, actions: actionOptions, actionControls } = options;
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

  const clipActions = document.createElement('div');
  clipActions.className = 'dev-workbench__actions';
  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.textContent = 'Play';
  const stopButton = document.createElement('button');
  stopButton.type = 'button';
  stopButton.textContent = 'Stop';
  const statusLabel = document.createElement('span');
  statusLabel.className = 'dev-workbench__status';
  statusLabel.textContent = 'Idle';
  clipActions.append(playButton, stopButton, statusLabel);

  const description = document.createElement('p');
  description.className = 'dev-workbench__description';
  description.textContent = 'Select an entity and animation to preview.';

  const actionSection = document.createElement('div');
  actionSection.className = 'dev-workbench__section';

  const actionSectionTitle = document.createElement('h3');
  actionSectionTitle.className = 'dev-workbench__section-title';
  actionSectionTitle.textContent = 'Chicken Actions';

  const actionInputs = document.createElement('div');
  actionInputs.className = 'dev-workbench__controls';

  const actionLabel = document.createElement('label');
  actionLabel.textContent = 'Action';
  const actionSelect = document.createElement('select');
  actionLabel.appendChild(actionSelect);
  actionInputs.appendChild(actionLabel);

  const actionTriggerRow = document.createElement('div');
  actionTriggerRow.className = 'dev-workbench__actions dev-workbench__action-trigger';
  const triggerActionButton = document.createElement('button');
  triggerActionButton.type = 'button';
  triggerActionButton.textContent = 'Trigger Action';
  const actionStatusLabel = document.createElement('span');
  actionStatusLabel.className = 'dev-workbench__status';
  actionStatusLabel.textContent = 'Ready';
  actionTriggerRow.append(triggerActionButton, actionStatusLabel);

  const actionNote = document.createElement('p');
  actionNote.className = 'dev-workbench__note';
  actionNote.textContent = 'Force the chicken to immediately run the selected action inside the pen.';

  actionSection.append(actionSectionTitle, actionInputs, actionTriggerRow, actionNote);

  body.append(controls, clipActions, description, actionSection);
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
  let availableActionIds: string[] = [];
  let selectedActionId: string | null = null;
  let lastActionStatus = '';
  let lastAvailabilityKey: string | null = null;

  const getActionLabel = (actionId: string | null) => {
    if (!actionId) {
      return '';
    }
    return actionOptions.find((option) => option.id === actionId)?.label ?? actionId;
  };

  const setActionStatus = (text: string) => {
    if (text === lastActionStatus) {
      return;
    }
    lastActionStatus = text;
    actionStatusLabel.textContent = text;
  };

  const updateActionButtonState = () => {
    const hasSelection = Boolean(selectedActionId && availableActionIds.includes(selectedActionId));
    triggerActionButton.disabled = !hasSelection || actionControls.isActive();
  };

  const refreshActionOptions = (ids: string[]) => {
    availableActionIds = ids;
    actionSelect.innerHTML = '';
    if (ids.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No actions available';
      actionSelect.appendChild(option);
      actionSelect.disabled = true;
      selectedActionId = null;
      updateActionButtonState();
      setActionStatus('No actions available');
      return;
    }
    actionSelect.disabled = false;
    ids.forEach((id) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = getActionLabel(id);
      actionSelect.appendChild(option);
    });
    if (!selectedActionId || !ids.includes(selectedActionId)) {
      selectedActionId = ids[0] ?? null;
    }
    if (selectedActionId) {
      actionSelect.value = selectedActionId;
    }
    updateActionButtonState();
  };

  const evaluateActionOptions = () => {
    const nextIds = actionOptions.filter((action) => action.isAvailable()).map((action) => action.id);
    const key = nextIds.join('|');
    if (key !== lastAvailabilityKey) {
      lastAvailabilityKey = key;
      refreshActionOptions(nextIds);
      return;
    }
    availableActionIds = nextIds;
    if (selectedActionId && !nextIds.includes(selectedActionId)) {
      selectedActionId = nextIds[0] ?? null;
      actionSelect.value = selectedActionId ?? '';
    }
  };

  const updateActionStatus = () => {
    if (!availableActionIds.length) {
      setActionStatus('No actions available');
      return;
    }
    if (actionControls.isActive()) {
      const activeLabel = getActionLabel(actionControls.getActiveId());
      setActionStatus(activeLabel ? `Active: ${activeLabel}` : 'Action running');
      return;
    }
    if (!selectedActionId) {
      setActionStatus('Select an action');
      return;
    }
    setActionStatus(`Ready: ${getActionLabel(selectedActionId)}`);
  };

  const setClipStatus = (text: string) => {
    statusLabel.textContent = text;
  };

  const stopClip = () => {
    if (clipRuntime) {
      clipRuntime.stop();
      clipRuntime = null;
    }
    setClipStatus('Idle');
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
    setClipStatus(`Playing: ${clip.label}`);
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

  actionSelect.addEventListener('change', () => {
    selectedActionId = actionSelect.value || null;
    updateActionButtonState();
    updateActionStatus();
  });

  triggerActionButton.addEventListener('click', () => {
    if (!selectedActionId) {
      return;
    }
    const triggered = actionControls.trigger(selectedActionId);
    if (!triggered) {
      updateActionButtonState();
      updateActionStatus();
      return;
    }
    updateActionButtonState();
    updateActionStatus();
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

  evaluateActionOptions();
  updateActionStatus();

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
        setClipStatus('Complete');
        updateButtons();
      }
    }
    evaluateActionOptions();
    updateActionButtonState();
    updateActionStatus();
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
