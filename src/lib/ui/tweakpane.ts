import { Pane } from 'tweakpane';
import { getSceneOptions } from '../visuals/registry';

export type TweakCallbacks = {
  onSlider?: (v: number) => void;
  onMicToggle?: (on: boolean) => void;
  onWireframeToggle?: (on: boolean) => void;
  onBackgroundColorChange?: (cssColor: string) => void;
  onPreferSecondScreen?: (on: boolean) => void;
  onSceneChange?: (sceneId: string) => void;
  onStartPreview?: () => void;
  onToggleProjection?: () => void;
};

export function initTweakpane(container: HTMLElement | null, initial: any = { multiplier: 3, micActive: false, hideCommon: false }, callbacks: TweakCallbacks = {}) {
  if (!container) return { dispose: () => {} };

  const pane = new Pane({ container, title: 'System Controls' } as any);
  const params: any = {
  preferSecondScreen: initial.preferSecondScreen ?? false,
  scene: initial.scene ?? 'sphere',
  };

  // Optionally create a persistent folder for controls shared across visuals (system controls).
  let commonFolder: any = null;
  if (!initial.hideCommon) {
    commonFolder = (pane as any).addFolder ? (pane as any).addFolder({ title: 'Controls' }) : null;

    // use folder-scoped addBinding/addInput if available, fall back to folder.addInput
    const addBinding = commonFolder && (commonFolder as any).addBinding ? (commonFolder as any).addBinding.bind(commonFolder) : undefined;
    const addInput = commonFolder && (commonFolder as any).addInput ? (commonFolder as any).addInput.bind(commonFolder) : undefined;

    const preferInput = addBinding ? addBinding(params, 'preferSecondScreen', { label: 'Use 2nd Screen' }) : (addInput ? addInput(params, 'preferSecondScreen', { label: 'Use 2nd Screen' }) : (pane as any).addInput(params, 'preferSecondScreen', { label: 'Use 2nd Screen' }));
    if (preferInput && typeof preferInput.on === 'function') {
      preferInput.on('change', (ev: any) => { callbacks.onPreferSecondScreen?.(ev.value ?? params.preferSecondScreen); });
    }
    // Start Preview button (compact label)
    try {
      const startBtn = (commonFolder as any)?.addButton ? (commonFolder as any).addButton({ title: 'Preview' }) : (pane as any).addButton ? (pane as any).addButton({ title: 'Preview' }) : null;
      try { startBtn?.on?.('click', () => { callbacks.onStartPreview?.(); }); } catch (e) {}
    } catch (e) {}

    // Toggle Projection button (compact label)
    try {
      const projBtn = (commonFolder as any)?.addButton ? (commonFolder as any).addButton({ title: 'Project' }) : (pane as any).addButton ? (pane as any).addButton({ title: 'Project' }) : null;
      try { projBtn?.on?.('click', () => { callbacks.onToggleProjection?.(); }); } catch (e) {}
    } catch (e) {}

    // Scene selection dropdown - populate from central registry
  const sceneOptions = getSceneOptions();
    const sceneInput = addBinding ? addBinding(params, 'scene', { options: sceneOptions, label: 'Visuals' }) : (addInput ? addInput(params, 'scene', { options: sceneOptions, label: 'Visuals' }) : (pane as any).addInput(params, 'scene', { options: sceneOptions, label: 'Visuals' }));
    if (sceneInput && typeof sceneInput.on === 'function') {
      sceneInput.on('change', (ev: any) => { callbacks.onSceneChange?.(ev.value ?? params.scene); });
    }
  }

  return {
    pane,
    params,
    dispose() {
      try {
        if (typeof (pane as any).dispose === 'function') (pane as any).dispose();
      } catch (e) {
        try { (pane as any).hidden = true; } catch (e) {}
      }
    }
  };
}

// Two-pane initializer: system pane (systemContainer) and visuals pane (visualsContainer).
export function initTweakpaneTwo(systemContainer: HTMLElement | null, visualsContainer: HTMLElement | null, initial: any = { multiplier: 3, micActive: false }, callbacks: TweakCallbacks = {}) {
  // create system pane
  const systemRes = initTweakpane(systemContainer, initial, callbacks as any);

  // create visuals pane (title only)
  let visualsPane: any = null;
  if (visualsContainer) {
    try {
      visualsPane = new Pane({ container: visualsContainer, title: 'Visuals' } as any);
    } catch (e) {
      try { console.warn('initTweakpaneTwo: failed to create visuals pane', e); } catch (e) {}
      visualsPane = null;
    }
  }

  return {
    systemPane: (systemRes as any).pane ?? null,
    visualsPane,
    params: (systemRes as any).params ?? {},
    dispose() {
      try { (systemRes as any).dispose?.(); } catch (e) {}
      try { if (visualsPane && typeof visualsPane.dispose === 'function') visualsPane.dispose(); } catch (e) {}
    }
  };
}
