// Scene base types and an abstract BaseScene class for artists to extend.
// This file defines the control schema and a small lifecycle contract.

export type ControlDef =
  | { type: 'range'; key: string; label: string; min: number; max: number; step?: number; default: number }
  | { type: 'boolean'; key: string; label: string; default?: boolean }
  | { type: 'select'; key: string; label: string; options: Record<string, string>; default?: string }
  | { type: 'color'; key: string; label: string; default?: string }
  | { type: 'number'; key: string; label: string; default?: number };

export interface SceneInstance {
  // optional async init for creating engine/meshes/materials
  init?: () => Promise<void> | void;
  // optional start when the scene manages its own render loop
  start?: () => void;
  // apply a control change (called by Tweakpane wiring)
  applyControl?: (key: string, value: any) => void;
  // return state/metadata for UI if needed
  getState?: () => Record<string, any>;
  // optional access to the underlying legacy scene setup (engine/scene/mesh)
  getSetup?: () => any;
  // cleanup resources
  dispose?: () => Promise<void> | void;
}

export interface SceneDefinition {
  id: string;
  label: string;
  controls?: ControlDef[];
  // factory returns a SceneInstance (or Promise thereof)
  create: (canvas: HTMLCanvasElement, opts?: any) => Promise<SceneInstance> | SceneInstance;
}

/**
 * BaseScene: a minimal abstract class implementing parts of SceneInstance.
 * Artists can extend this and override lifecycle methods and implement
 * onControl_<key> handlers to respond to controls.
 */
export abstract class BaseScene implements SceneInstance {
  protected canvas: HTMLCanvasElement;
  protected ready = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<void> {
    this.ready = true;
  }

  start(): void {
    // default: no-op
  }

  applyControl(key: string, value: any): void {
    // If subclass defines an `onControl_<key>` method, call it.
    const handlerName = `onControl_${key}`;
    const fn = (this as any)[handlerName];
    if (typeof fn === 'function') {
      try { fn.call(this, value); } catch (e) { /* swallow to avoid UI break */ }
      return;
    }

    // Common keys that many scenes might implement
    if (key === 'multiplier' && typeof (this as any)['setMultiplier'] === 'function') {
      try { (this as any)['setMultiplier'](Number(value)); } catch (e) {}
      return;
    }
    if (key === 'wireframe' && typeof (this as any)['setWireframe'] === 'function') {
      try { (this as any)['setWireframe'](Boolean(value)); } catch (e) {}
      return;
    }
    if (key === 'background' && typeof (this as any)['setBackgroundColor'] === 'function') {
      try { (this as any)['setBackgroundColor'](String(value)); } catch (e) {}
      return;
    }

    // otherwise ignore unknown control
  }

  getState(): Record<string, any> { return {}; }

  async dispose(): Promise<void> { this.ready = false; }
}
