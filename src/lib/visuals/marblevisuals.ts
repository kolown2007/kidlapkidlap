import { Engine, Scene, ArcRotateCamera, HemisphericLight, MeshBuilder, Texture, Effect, ShaderMaterial, Vector3, Mesh, Vector2 } from '@babylonjs/core';
import { BaseScene } from '../core/sceneBase';
import type { SceneDefinition, SceneInstance } from '../core/sceneBase';

import vertexSrc from './shaders/vanilla.vert?raw';
import fragmentSrc from './shaders/marble.frag?raw';
import minecraftFrag from './shaders/minecraft.frag?raw';

class MarbleVisualScene extends BaseScene implements SceneInstance {
  engine!: Engine;
  scene!: Scene;
  mesh: any = null;
  material: any = null;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
  }

  async init() {
    const canvas = this.canvas as HTMLCanvasElement;
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);

    const camera = new ArcRotateCamera('cam', Math.PI / 2, Math.PI / 2.5, 6, Vector3.Zero(), this.scene);
    try { camera.attachControl(canvas, true); } catch (e) {}

    new HemisphericLight('h', new Vector3(0,1,0), this.scene);

    try {
      (Effect as any).ShadersStore = (Effect as any).ShadersStore || {};
      (Effect as any).ShadersStore['vanillaVertexShader'] = vertexSrc;
      (Effect as any).ShadersStore['marbleFragmentShader'] = fragmentSrc;
      // also register the minecraft fragment so we can switch at runtime
      (Effect as any).ShadersStore['minecraftFragmentShader'] = minecraftFrag;
      console.log('Marble + Minecraft shaders registered');
    } catch (e) { console.warn('Failed to register marble/minecraft shaders', e); }

    // create initial material (default: marble)
    this.createMaterial('marble');

    const computePlaneSize = () => {
      const distance = (camera as any).radius ?? Vector3.Distance(camera.position, camera.target);
      const fov = (camera as any).fov ?? (Math.PI / 4);
      const widthPx = this.engine.getRenderWidth();
      const heightPx = this.engine.getRenderHeight();
      const aspect = Math.max(1e-6, widthPx / Math.max(1, heightPx));
      const planeHeight = 2 * distance * Math.tan(fov / 2);
      const planeWidth = planeHeight * aspect;
      return { w: planeWidth, h: planeHeight };
    };

    const size = computePlaneSize();
    this.mesh = MeshBuilder.CreatePlane('plane_marble', { width: size.w, height: size.h }, this.scene);
    try { this.mesh.position = camera.target.clone(); } catch (e) {}
    try { (this.mesh as any).billboardMode = Mesh.BILLBOARDMODE_ALL; } catch (e) {}
  // apply material created earlier (createMaterial was called before mesh existed)
  try { if (this.material) this.mesh.material = this.material; } catch (e) {}

    let frameCount = 0;
    try { this.scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.001;
      try { if (this.material) this.material.setFloat('iTime', t); } catch (e) {}
      try { if (this.material) this.material.setVector2('iResolution', new Vector2(this.engine.getRenderWidth(), this.engine.getRenderHeight())); } catch (e) {}
      try { if (this.material) this.material.setInt('iFrame', frameCount); } catch (e) { try { if (this.material) this.material.setFloat('iFrame', frameCount); } catch (e) {} }
      frameCount++;
    }); } catch (e) {}

    this.engine.runRenderLoop(() => { try { this.scene.render(); } catch (e) {} });
    this.ready = true;

    try {
      window.addEventListener('resize', () => {
        try {
          const newSize = computePlaneSize();
          if (this.mesh) {
            this.mesh.scaling.x = newSize.w / size.w;
            this.mesh.scaling.y = newSize.h / size.h;
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

  getSetup() { return { engine: this.engine, scene: this.scene, mesh: this.mesh, material: this.material }; }

  setMultiplier(v: number) { try { if (this.mesh) this.mesh.scaling.setAll(v); } catch (e) {} }
  setWireframe(on: boolean) { try { if (this.material) this.material.wireframe = !!on; } catch (e) {} }
  setBackgroundColor(hex: string) { /* no-op */ }

  applyControl(key: string, value: any): void {
    super.applyControl(key, value);
    try { if (key === 'wireframe') this.setWireframe(!!value); } catch (e) {}
  }

  // Create or replace the ShaderMaterial using the given fragment base name.
  createMaterial(fragmentBase: string) {
    try { if (this.material) { try { this.material.dispose(); } catch (e) {} } } catch (e) {}

    const mat = new ShaderMaterial('marbleShader', this.scene, {
      vertex: 'vanilla',
      fragment: fragmentBase
    }, {
      attributes: ['position', 'normal', 'uv'],
      uniforms: ['world', 'worldView', 'worldViewProjection', 'view', 'projection', 'iTime', 'iResolution', 'iFrame', 'iMouse'],
      samplers: []
    });
    mat.backFaceCulling = false;
    this.material = mat;
    if (this.mesh) this.mesh.material = mat;
    return mat;
  }

  // Handler for fragment dropdown control
  onControl_fragment(v: string) {
    try { this.createMaterial(String(v)); } catch (e) {}
  }

  getState() { return {}; }

  async dispose() {
    try { this.engine.stopRenderLoop(); } catch (e) {}
    try { this.scene.dispose(); } catch (e) {}
    try { this.engine.dispose(); } catch (e) {}
    this.ready = false;
  }
}

export const marbleVisuals: SceneDefinition = {
  id: 'marble',
  label: 'Marblelights',
  controls: [
  { type: 'boolean', key: 'wireframe', label: 'Wireframe', default: false },
  { type: 'select', key: 'fragment', label: 'Fragment', options: { 'Marble': 'marble', 'Minecraft': 'minecraft' }, default: 'marble' }
  ],
  create: async (canvas: HTMLCanvasElement, opts?: any) => {
    const s = new MarbleVisualScene(canvas);
    if (opts?.renderDataProvider) (s as any).renderDataProvider = opts.renderDataProvider;
    await s.init();
    return s;
  }
};

export default marbleVisuals;
