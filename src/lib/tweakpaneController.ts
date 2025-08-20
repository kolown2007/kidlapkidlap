import { initTweakpane, type TweakCallbacks } from './tweakpane';

export type TweakpaneDeps = {
  applyMultiplier: (v: number) => void;
  onMicToggle: (on: boolean) => Promise<void> | void;
  setWireframe: (on: boolean) => void;
  setBackgroundColor: (color: string) => void;
  setPreferSecondScreen: (on: boolean) => void;
};

export function createTweakpaneController(container: HTMLElement | null, initial: any, deps: TweakpaneDeps) {
  if (!container) return { dispose: () => {} };

  const callbacks: TweakCallbacks = {
    onSlider: (v) => {
      try { deps.applyMultiplier(v); } catch (e) {}
    },
    onMicToggle: (on) => {
      try { deps.onMicToggle(on); } catch (e) {}
    },
    onWireframeToggle: (on) => {
      try { deps.setWireframe(!!on); } catch (e) {}
    },
    onBackgroundColorChange: (c) => {
      try { deps.setBackgroundColor(c); } catch (e) {}
    },
    onPreferSecondScreen: (on) => {
      try { deps.setPreferSecondScreen(!!on); } catch (e) {}
    }
  };

  const pane = initTweakpane(container, initial, callbacks as any);

  return {
    dispose() {
      try { pane?.dispose?.(); } catch (e) {}
    }
  };
}

export default createTweakpaneController;
