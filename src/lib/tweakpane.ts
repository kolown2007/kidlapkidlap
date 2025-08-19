import { Pane } from 'tweakpane';

export type TweakCallbacks = {
  onSlider?: (v: number) => void;
  onMicToggle?: (on: boolean) => void;
  onWireframeToggle?: (on: boolean) => void;
  onBackgroundColorChange?: (cssColor: string) => void;
  onPreferSecondScreen?: (on: boolean) => void;
};

export function initTweakpane(container: HTMLElement | null, initial: any = { multiplier: 3, micActive: false }, callbacks: TweakCallbacks = {}) {
  if (!container) return { dispose: () => {} };

  const pane = new Pane({ container, title: 'Controls' } as any);
  const params: any = {
    multiplier: initial.multiplier ?? 3,
    micActive: initial.micActive ?? false,
  wireframe: initial.wireframe ?? false,
  backgroundColor: initial.backgroundColor ?? '#000000',
  preferSecondScreen: initial.preferSecondScreen ?? false,
  };

  // use addBinding if available, fall back to addInput
  const addBinding = (pane as any).addBinding ? (pane as any).addBinding.bind(pane) : undefined;
  const addInput = (pane as any).addInput ? (pane as any).addInput.bind(pane) : undefined;

  const slider = addBinding ? addBinding(params, 'multiplier', { min: 0, max: 9, step: 1 }) : addInput(params, 'multiplier', { min: 0, max: 9, step: 1 });
  if (slider && typeof slider.on === 'function') {
    slider.on('change', (ev: any) => {
      callbacks.onSlider?.(ev.value ?? params.multiplier);
    });
  }

  const micToggle = addBinding ? addBinding(params, 'micActive', { label: 'Mic' }) : addInput(params, 'micActive', { label: 'Mic' });
  if (micToggle && typeof micToggle.on === 'function') {
    micToggle.on('change', (ev: any) => {
      callbacks.onMicToggle?.(ev.value ?? params.micActive);
    });
  }

  const wireToggle = addBinding ? addBinding(params, 'wireframe', { label: 'Wireframe' }) : addInput(params, 'wireframe', { label: 'Wireframe' });
  if (wireToggle && typeof wireToggle.on === 'function') {
    wireToggle.on('change', (ev: any) => { callbacks.onWireframeToggle?.(ev.value ?? params.wireframe); });
  }

  const colorInput = addBinding ? addBinding(params, 'backgroundColor', { view: 'color' }) : addInput(params, 'backgroundColor', { view: 'color' });
  if (colorInput && typeof colorInput.on === 'function') {
    colorInput.on('change', (ev: any) => { callbacks.onBackgroundColorChange?.(ev.value ?? params.backgroundColor); });
  }

  const preferInput = addBinding ? addBinding(params, 'preferSecondScreen', { label: 'Use 2nd Screen' }) : addInput(params, 'preferSecondScreen', { label: 'Use 2nd Screen' });
  if (preferInput && typeof preferInput.on === 'function') {
    preferInput.on('change', (ev: any) => { callbacks.onPreferSecondScreen?.(ev.value ?? params.preferSecondScreen); });
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
