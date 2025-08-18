import { Pane } from 'tweakpane';

export type TweakCallbacks = {
  onSlider?: (v: number) => void;
  onMicToggle?: (on: boolean) => void;
};

export function initTweakpane(container: HTMLElement | null, initial = { multiplier: 3, micActive: false }, callbacks: TweakCallbacks = {}) {
  if (!container) return { dispose: () => {} };

  const pane = new Pane({ container, title: 'Controls' } as any);
  const params: any = {
    multiplier: initial.multiplier ?? 3,
    micActive: initial.micActive ?? false,
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
