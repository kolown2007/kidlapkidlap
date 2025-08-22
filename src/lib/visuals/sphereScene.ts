import { Color4, Engine, Scene, ArcRotateCamera, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Vector3, Effect, ShaderMaterial, Texture, Vector2, Mesh } from '@babylonjs/core';
import { BaseScene } from '../core/sceneBase';
import type { SceneDefinition, SceneInstance } from '../core/sceneBase';

import vertexSrc from './shaders/minecraft.vert?raw';
import fragmentSrc from './shaders/minecraft.frag?raw';

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

    this.sphere = MeshBuilder.CreateSphere('sphere', { diameter: 1.5, segments: 64 }, this.scene);

    // Register and apply minecraft ShaderMaterial
    try {
      (Effect as any).ShadersStore = (Effect as any).ShadersStore || {};
      (Effect as any).ShadersStore['minecraftVertexShader'] = vertexSrc;
      (Effect as any).ShadersStore['minecraftFragmentShader'] = fragmentSrc;
    } catch (e) { console.warn('Shader registration failed', e); }

    const shaderMat = new ShaderMaterial('minecraftShaderSphere', this.scene, {
      vertex: 'minecraft',
      fragment: 'minecraft'
    }, {
      attributes: ['position', 'normal', 'uv'],
      uniforms: ['world', 'worldView', 'worldViewProjection', 'view', 'projection', 'iTime', 'iResolution', 'iFrame', 'uMaxIter'],
      samplers: ['iChannel0', 'iChannel1']
    });

    try { shaderMat.setTexture('iChannel0', new Texture('/textures/abstract.png', this.scene)); } catch (e) {}
    shaderMat.backFaceCulling = false;
    this.sphere.material = shaderMat;

    // create a background plane for the sphere scene and apply a simple bg shader
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

    const bgSize = computePlaneSize();
    const bgPlane = MeshBuilder.CreatePlane('bg_plane_sphere', { width: bgSize.w, height: bgSize.h }, this.scene);
    try { bgPlane.position = camera.target.clone(); } catch (e) {}
    try { (bgPlane as any).billboardMode = Mesh.BILLBOARDMODE_ALL; } catch (e) {}

    try {
      // register bgTest fragment shader using the expected '<base>FragmentShader' key
      (Effect as any).ShadersStore['bgTestFragmentShader'] = `precision highp float; varying vec2 vUV; uniform float iTime; void main(){ vec2 uv = vUV; float t = iTime; vec3 c = vec3(0.2+0.7*sin(t+uv.x*6.2831), 0.1+0.6*cos(t+uv.y*6.2831), 0.4); gl_FragColor = vec4(c,1.0); }`;
    } catch (e) {}

    const bgMat = new ShaderMaterial('minecraftBackgroundSphere', this.scene, {
      vertex: 'minecraft',
      fragment: 'bgTest'
    }, {
      attributes: ['position', 'normal', 'uv'],
      uniforms: ['world', 'worldView', 'worldViewProjection', 'view', 'projection', 'iTime', 'iResolution', 'iFrame'],
      samplers: []
    });
    bgMat.backFaceCulling = false;
    bgPlane.material = bgMat;
    try { bgPlane.renderingGroupId = 0; (this.sphere as any).renderingGroupId = 1; } catch (e) {}

    let frameCount = 0;
    try { this.scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.001;
      try { shaderMat.setFloat('iTime', t); } catch (e) {}
      try { shaderMat.setVector2('iResolution', new Vector2(this.engine.getRenderWidth(), this.engine.getRenderHeight())); } catch (e) {}
      try { shaderMat.setInt('iFrame', frameCount); } catch (e) { try { shaderMat.setFloat('iFrame', frameCount); } catch (e) {} }

      try { bgMat.setFloat('iTime', t); } catch (e) {}
      try { bgMat.setVector2('iResolution', new Vector2(this.engine.getRenderWidth(), this.engine.getRenderHeight())); } catch (e) {}
      try { bgMat.setInt('iFrame', frameCount); } catch (e) { try { bgMat.setFloat('iFrame', frameCount); } catch (e) {} }

      frameCount++;
    }); } catch (e) {}

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
  label: 'QuantumSystem',
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
