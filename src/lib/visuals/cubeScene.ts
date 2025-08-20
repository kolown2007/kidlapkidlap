import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4 } from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';
import { BaseScene } from '../core/sceneBase';
import type { SceneDefinition, SceneInstance } from '../core/sceneBase';

// Legacy-style factory so previewController can still use sceneFactory/startLoop pattern
export interface CubeSceneSetup {
  engine: Engine;
  scene: Scene;
  box: Mesh;
  material?: StandardMaterial;
  dispose: () => void;
}

export function createBabylonCubeScene(canvas: HTMLCanvasElement): CubeSceneSetup {
  const engine = new Engine(canvas, true);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  engine.setHardwareScalingLevel(1 / dpr);
  const scene = new Scene(engine);

  const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2.5, 6, new Vector3(0, 0, 0), scene);
  camera.attachControl(canvas, true);

  const light = new HemisphericLight('light', new Vector3(1, 1, 0), scene);

  const box = MeshBuilder.CreateBox('cube', { size: 2 }, scene);
  const mat = new StandardMaterial('cube-mat', scene);
  mat.diffuseColor = new Color3(1, 1, 1);
  box.material = mat;

  const handleResize = () => {
    try { engine.resize(); } catch (e) {}
  };
  window.addEventListener('resize', handleResize);

  const dispose = () => {
    try { window.removeEventListener('resize', handleResize); } catch (e) {}
    try { mat.dispose(); } catch (e) {}
    try { engine.dispose(); } catch (e) {}
  };

  // keep a `torus` alias for backwards compatibility with existing sceneController checks
  return {
    engine,
    scene,
    box,
    material: mat,
    dispose: dispose
  };
}

export function startCubeRenderLoop(engine: Engine, scene: Scene, box: Mesh, getAudioData: () => { volume: number; value: number }) {
  engine.runRenderLoop(() => {
    const { volume, value } = getAudioData();

    const minSize = 0.5;
    const maxSize = 5;
    let norm = Math.max(-60, Math.min(0, volume));
    norm = (norm + 60) / 60;
    const audioScale = minSize + (1 - norm) * (maxSize - minSize);

    const multiplier = 0.5 + ((value / 9) * 1.5);
    const final = audioScale * multiplier;

    if (box) {
      box.scaling.x = final / 2;
      box.scaling.y = final / 2;
      box.scaling.z = final / 2;
    }

    try {
      localStorage.setItem('vj-state', JSON.stringify({ diameterMultiplier: final, volume, sliderValue: value, timestamp: Date.now() }));
    } catch (e) {}

    scene.render();
  });
}

// Class-based scene instance for the new BaseScene API
class CubeScene extends BaseScene implements SceneInstance {
  private setup: CubeSceneSetup | null = null;
  private multiplier = 1;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
  }

  async init() {
    // create engine/scene/box
    this.setup = createBabylonCubeScene(this.canvas);
    this.ready = true;
  }

  getSetup() { return this.setup; }

  start() {
    // no-op; previewController / external loop can be used. But if desired, we could
    // start an internal loop here.
  }

  setMultiplier(v: number) {
    this.multiplier = v;
    const mesh = this.setup?.box as any;
    if (mesh) {
      try { mesh.scaling.x = v; mesh.scaling.y = v; mesh.scaling.z = v; } catch (e) {}
    }
  }

  setWireframe(on: boolean) {
    try { if (this.setup?.material) (this.setup.material as any).wireframe = !!on; } catch (e) {}
  }

  setBackgroundColor(hex: string) {
    try { if (this.setup?.scene) (this.setup.scene as any).clearColor = Color4.FromHexString ? Color4.FromHexString(hex) : new Color4(0,0,0,1); } catch (e) {}
  }

  applyControl(key: string, value: any): void {
    // delegate to BaseScene common handlers first
    super.applyControl(key, value);
    // also support specific keys
    if (key === 'cubeSize' || key === 'multiplier') {
      this.setMultiplier(Number(value));
    }
  }

  getState() { return { multiplier: this.multiplier }; }

  async dispose() {
    try { this.setup?.dispose(); } catch (e) {}
    this.setup = null;
    this.ready = false;
  }
}

export const cubeScene: SceneDefinition = {
  id: 'cube',
  label: 'Cube',
  controls: [
    { type: 'range', key: 'multiplier', label: 'multiplier', min: 0.5, max: 6, step: 0.1, default: 1 },
    { type: 'boolean', key: 'wireframe', label: 'Wireframe', default: false },
    { type: 'color', key: 'background', label: 'background', default: '#000000' }
  ],
  create: async (canvas: HTMLCanvasElement) => {
    const s = new CubeScene(canvas);
    await s.init();
    return s;
  }
};

export default cubeScene;
