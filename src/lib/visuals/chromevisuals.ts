import { Engine, Scene, ArcRotateCamera, HemisphericLight, MeshBuilder, Texture, Effect, ShaderMaterial, Vector3, Mesh } from '@babylonjs/core';
import { BaseScene } from '../core/sceneBase';
import type { SceneDefinition, SceneInstance } from '../core/sceneBase';

// Import shaders as raw text so editors and tooling can highlight/lint them
import vertexSrc from './shaders/chrome.vert?raw';
import fragmentSrc from './shaders/chrome.frag?raw';

class ChromeVisualScene extends BaseScene implements SceneInstance {
  engine!: Engine;
  scene!: Scene;
  mesh: any = null;
  material: any = null;
  private _wheelHandler: ((e: WheelEvent) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
  }

  async init() {
    const canvas = this.canvas as HTMLCanvasElement;
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);

    // place camera further back so the plane doesn't fill the view
    const camera = new ArcRotateCamera('cam', Math.PI / 2, Math.PI / 2.5, 6, Vector3.Zero(), this.scene);
    // attach control but immediately clear inputs so the camera stays fixed (disable user orbit/zoom)
    try { camera.attachControl(canvas, true); } catch (e) {}
    try { camera.inputs.clear(); } catch (e) {}

    // Also add an explicit non-passive wheel handler to block page scroll while over the canvas
    try {
      canvas.style.touchAction = 'none';
      this._wheelHandler = (e: WheelEvent) => { try { e.preventDefault(); } catch (e) {} };
      canvas.addEventListener('wheel', this._wheelHandler as EventListener, { passive: false });
    } catch (e) {}

    new HemisphericLight('h', new Vector3(0,1,0), this.scene);

    // Register shaders in Babylon's store under the key 'custom'
    try {
      (Effect as any).ShadersStore = (Effect as any).ShadersStore || {};
      (Effect as any).ShadersStore['customVertexShader'] = vertexSrc;
      (Effect as any).ShadersStore['customFragmentShader'] = fragmentSrc;
    } catch (e) {}

    // Create shader material
    const shaderMat = new ShaderMaterial('customShader', this.scene, {
      vertex: 'custom',
      fragment: 'custom'
    }, {
      attributes: ['position', 'normal', 'uv'],
      uniforms: ['world', 'worldView', 'worldViewProjection', 'view', 'projection', 'time', 'amplitude', 'frequency', 'speed']
    });


  // Bind a texture
  const tex = new Texture('/textures/abstract.png', this.scene);
  try { shaderMat.setTexture('textureSampler', tex); } catch (e) {}

  // set default wave parameters
  try { shaderMat.setFloat('time', 0); } catch (e) {}
  try { shaderMat.setFloat('amplitude', 0.12); } catch (e) {}
  try { shaderMat.setFloat('frequency', 3.0); } catch (e) {}
  try { shaderMat.setFloat('speed', 1.5); } catch (e) {}

    shaderMat.backFaceCulling = false;

    // Create a plane sized to exactly fill the camera view.
    const computePlaneSize = () => {
      // distance from camera to target
      const distance = (camera as any).radius ?? Vector3.Distance(camera.position, camera.target);
      const fov = (camera as any).fov ?? (Math.PI / 4);
      const widthPx = this.engine.getRenderWidth();
      const heightPx = this.engine.getRenderHeight();
      const aspect = Math.max(1e-6, widthPx / Math.max(1, heightPx));
      // vertical size that fills fov at given distance
      const planeHeight = 2 * distance * Math.tan(fov / 2);
      const planeWidth = planeHeight * aspect;
      return { w: planeWidth, h: planeHeight };
    };

  const size = computePlaneSize();
  this.mesh = MeshBuilder.CreatePlane('plane', { width: size.w, height: size.h }, this.scene);
    // Center the plane at the scene target and make it face the camera
    try { this.mesh.position = camera.target.clone(); } catch (e) {}
    try { (this.mesh as any).billboardMode = Mesh.BILLBOARDMODE_ALL; } catch (e) {}
    this.mesh.material = shaderMat;
    this.material = shaderMat;

    // update time uniform each frame and render
    try { this.scene.onBeforeRenderObservable.add(() => {
      try { shaderMat.setFloat('time', performance.now() * 0.001); } catch (e) {}
    }); } catch (e) {}
    this.engine.runRenderLoop(() => { try { this.scene.render(); } catch (e) {} });
    this.ready = true;
    // Watch for resize to update plane size
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
  setBackgroundColor(hex: string) { /* reuse default behavior if needed */ }

  applyControl(key: string, value: any): void {
    super.applyControl(key, value);
    try {
      if (key === 'multiplier') this.setMultiplier(Number(value));
      if (key === 'amplitude') try { this.material?.setFloat?.('amplitude', Number(value)); } catch (e) {}
      if (key === 'frequency') try { this.material?.setFloat?.('frequency', Number(value)); } catch (e) {}
      if (key === 'speed') try { this.material?.setFloat?.('speed', Number(value)); } catch (e) {}
    } catch (e) {}
  }

  async dispose() {
    try { this.engine.stopRenderLoop(); } catch (e) {}
    try { this.scene.dispose(); } catch (e) {}
    try { this.engine.dispose(); } catch (e) {}
    try {
      const canvas = this.canvas as HTMLCanvasElement;
      if (this._wheelHandler) {
        try { canvas.removeEventListener('wheel', this._wheelHandler as EventListener); } catch (e) {}
        this._wheelHandler = null;
      }
      try { canvas.style.touchAction = ''; } catch (e) {}
    } catch (e) {}
    this.ready = false;
  }
}

export const chromeVisuals: SceneDefinition = {
  id: 'chrome',
  label: 'Abstractwave',
  controls: [
    { type: 'range', key: 'multiplier', label: 'multiplier', min: 0.2, max: 4, step: 0.1, default: 1 },
    { type: 'boolean', key: 'wireframe', label: 'Wireframe', default: false },
    { type: 'color', key: 'background', label: 'background', default: '#000000' },
    { type: 'range', key: 'amplitude', label: 'Wave Amplitude', min: 0, max: 1, step: 0.01, default: 0.12 },
    { type: 'range', key: 'frequency', label: 'Wave Frequency', min: 0.1, max: 10, step: 0.1, default: 3.0 },
    { type: 'range', key: 'speed', label: 'Wave Speed', min: 0, max: 5, step: 0.1, default: 1.5 }
  ],
  create: async (canvas: HTMLCanvasElement, opts?: any) => {
    const s = new ChromeVisualScene(canvas);
    if (opts?.renderDataProvider) (s as any).renderDataProvider = opts.renderDataProvider;
    await s.init();
    return s;
  }
};

export default chromeVisuals;
