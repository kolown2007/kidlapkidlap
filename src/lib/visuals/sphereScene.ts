import { Color4, Engine, Scene, ArcRotateCamera, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';
import { BaseScene } from '../core/sceneBase';
import type { SceneDefinition, SceneInstance } from '../core/sceneBase';

class SphereScene extends BaseScene implements SceneInstance {
  engine!: Engine;
  scene!: Scene;
  sphere: any = null;
  private multiplier = 1;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
  }

  async init() {
    const canvas = this.canvas as HTMLCanvasElement;
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);

  const camera = new ArcRotateCamera('cam', Math.PI / 2, Math.PI / 2.5, 4, Vector3.Zero(), this.scene);
    camera.attachControl(canvas, true);

    new HemisphericLight('h', undefined as any, this.scene);

    this.sphere = MeshBuilder.CreateSphere('sphere', { diameter: 1.5 }, this.scene);
    const mat = new StandardMaterial('m', this.scene);
    mat.diffuseColor = new Color3(0.2, 0.4, 0.8);
    this.sphere.material = mat;

    this.engine.runRenderLoop(() => { this.scene.render(); });
    this.ready = true;
  }

  getSetup() { return { engine: this.engine, scene: this.scene, sphere: this.sphere, material: this.sphere?.material }; }

  setMultiplier(v: number) {
    this.multiplier = v;
    if (this.sphere) try { this.sphere.scaling.x = v; this.sphere.scaling.y = v; this.sphere.scaling.z = v; } catch (e) {}
  }

  setWireframe(on: boolean) { try { if (this.sphere?.material) this.sphere.material.wireframe = !!on; } catch (e) {} }

  setBackgroundColor(hex: string) { try { if (this.scene) (this.scene as any).clearColor = (Color4 as any).FromHexString ? (Color4 as any).FromHexString(hex) : new Color4(0,0,0,1); } catch (e) {} }

  applyControl(key: string, value: any): void {
    super.applyControl(key, value);
    if (key === 'multiplier' || key === 'sphereSize') this.setMultiplier(Number(value));
  }

  getState() { return { multiplier: this.multiplier }; }

  async dispose() {
    try { this.engine.stopRenderLoop(); } catch (e) {}
    try { this.scene.dispose(); } catch (e) {}
    try { this.engine.dispose(); } catch (e) {}
    this.ready = false;
  }
}

export const sphereScene: SceneDefinition = {
  id: 'sphere',
  label: 'Sphere',
  controls: [
    { type: 'range', key: 'multiplier', label: 'multiplier', min: 0.5, max: 6, step: 0.1, default: 1 },
    { type: 'boolean', key: 'wireframe', label: 'Wireframe', default: false },
    { type: 'color', key: 'background', label: 'background', default: '#000000' }
  ],
  create: async (canvas: HTMLCanvasElement, opts?: any) => {
    const s = new SphereScene(canvas);
    if (opts?.renderDataProvider) (s as any).renderDataProvider = opts.renderDataProvider;
    await s.init();
    return s;
  }
};

export default sphereScene;
