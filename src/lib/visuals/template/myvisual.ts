import { Engine, Scene, ArcRotateCamera, HemisphericLight, MeshBuilder, Texture, Effect, ShaderMaterial, Vector3, Vector2 } from '@babylonjs/core';
import { BaseScene } from '../../core/sceneBase';
import type { SceneDefinition, SceneInstance } from '../../core/sceneBase';

import vertexSrc from './shaders/myvisual.vert?raw';
import fragmentSrc from './shaders/myvisual.frag?raw';

class MyVisual extends BaseScene implements SceneInstance {
  engine!: Engine;
  scene!: Scene;
  mesh: any = null;
  material: any = null;

  constructor(canvas: HTMLCanvasElement) { super(canvas); }

  async init() {
    const canvas = this.canvas as HTMLCanvasElement;
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);

    const camera = new ArcRotateCamera('cam', Math.PI/2, Math.PI/2.5, 6, Vector3.Zero(), this.scene);
    try { camera.attachControl(canvas, true); } catch (e) {}

    new HemisphericLight('h', new Vector3(0,1,0), this.scene);

    // register shaders
    (Effect as any).ShadersStore = (Effect as any).ShadersStore || {};
    (Effect as any).ShadersStore['myvisualVertexShader'] = vertexSrc;
    (Effect as any).ShadersStore['myvisualFragmentShader'] = fragmentSrc;

    const mat = new ShaderMaterial('mat_myvisual', this.scene, { vertex: 'myvisual', fragment: 'myvisual' }, {
      attributes: ['position', 'normal', 'uv'],
      uniforms: ['world', 'worldView', 'worldViewProjection', 'view', 'projection', 'iTime', 'iResolution', 'iFrame'],
      samplers: ['iChannel0']
    });

    this.mesh = MeshBuilder.CreatePlane('plane_template', { width: 2, height: 2 }, this.scene);
    this.mesh.material = mat;
    this.material = mat;

    let frame = 0;
    this.scene.onBeforeRenderObservable.add(() => {
      try { mat.setFloat('iTime', performance.now()*0.001); } catch (e) {}
      try { mat.setVector2('iResolution', new Vector2(this.engine.getRenderWidth(), this.engine.getRenderHeight())); } catch (e) {}
      try { mat.setInt('iFrame', frame++); } catch (e) { try { mat.setFloat('iFrame', frame++); } catch (e) {} }
    });

    this.engine.runRenderLoop(() => this.scene.render());
    this.ready = true;
  }

  getSetup() { return { engine: this.engine, scene: this.scene, mesh: this.mesh, material: this.material }; }
  setMultiplier(v:number) { try { if (this.mesh) this.mesh.scaling.setAll(v); } catch (e) {} }
  setWireframe(b:boolean) { try { if (this.material) this.material.wireframe = !!b; } catch (e) {} }
  setBackgroundColor(hex:string) {}

  async dispose() { try { this.engine.stopRenderLoop(); } catch (e) {}; try { this.scene.dispose(); } catch (e) {}; try { this.engine.dispose(); } catch (e) {}; this.ready = false; }
}

export const MyVisualDef: SceneDefinition = {
  id: 'myvisual',
  label: 'My Visual (template)',
  controls: [],
  create: async (canvas: HTMLCanvasElement) => { const s = new MyVisual(canvas); await s.init(); return s; }
};

export default MyVisualDef;
