// renderer.worker.ts
// Babylon-based OffscreenCanvas worker: initializes a Babylon Engine on the transferred OffscreenCanvas
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, Color3 } from '@babylonjs/core';

let canvas: OffscreenCanvas | null = null;
let engine: any = null;
let scene: any = null;
let torus: any = null;
let fps = 60;
let multiplier = 1;
let speed = 0.01;
let audioLevel = 0;

function createScene() {
  if (!engine) return null;
  const sc = new Scene(engine);
  const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2.5, 6, new Vector3(0, 0, 0), sc);
  camera.setTarget(Vector3.Zero());

  const light = new HemisphericLight('light', new Vector3(1, 1, 0), sc);

  torus = MeshBuilder.CreateTorus('torus', { diameter: 2, thickness: 0.2 }, sc);
  try {
    const mat = sc.getMaterialByName('torusMaterial') || null;
  } catch (e) {}

  sc.clearColor = new Color3(0.1, 0.6, 0.9).toColor4();
  return sc;
}

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'init' && msg.canvas) {
    canvas = msg.canvas as OffscreenCanvas;
    fps = msg.fps || fps;
    try {
      // create Babylon engine with the OffscreenCanvas
      engine = new Engine(canvas as any, true, undefined, false);
      scene = createScene();

      // start render loop
      engine.runRenderLoop(() => {
        try {
          if (scene) {
            // Apply multiplier and rotation speed
            if (torus) {
              try {
                // map audioLevel to an amplitude in [0,1]
                let amp = Number(audioLevel) || 0;
                if (amp < 0) {
                  // assume dB value from meter, convert to linear amplitude
                  amp = Math.pow(10, amp / 20);
                }
                amp = Math.min(Math.max(amp, 0), 1);
                const audioBoost = 1 + amp * 3.5; // up to +350% size from audio (more responsive)
                const finalScale = multiplier * audioBoost;
                torus.scaling.x = finalScale;
                torus.scaling.y = finalScale;
                torus.scaling.z = finalScale;
              } catch (e) {}
              try { torus.rotation.y += speed; } catch (e) {}
            }
            scene.render();
          }
        } catch (e) {
          // swallow
        }
      });
    } catch (e) {
      console.error('renderer.worker: failed to init Babylon engine', e);
    }
  } else if (msg.type === 'setColor' && Array.isArray(msg.color)) {
    // Map color to clearColor
    try {
      const c = msg.color.map((v: number) => Math.max(0, Math.min(1, Number(v))));
      if (scene) scene.clearColor = new Color3(c[0], c[1], c[2]).toColor4();
    } catch (e) {}
  } else if (msg.type === 'resize') {
    try {
      const w = msg.width; const h = msg.height;
      if (canvas && w && h) {
        canvas.width = w; canvas.height = h;
      }
      if (engine) engine.resize();
    } catch (e) {}
  } else if (msg.type === 'dispose') {
    try {
      if (engine) {
        try { engine.stopRenderLoop(); } catch (e) {}
        try { engine.dispose(); } catch (e) {}
      }
      canvas = null; engine = null; scene = null; torus = null;
  try { (self as any).close(); } catch (e) {}
    } catch (e) {}
  }
  else if (msg.type === 'setAudioLevel') {
    try { audioLevel = Number(msg.value) || 0; } catch (e) { audioLevel = 0; }
  }
  else if (msg.type === 'setMultiplier') {
    try { multiplier = Number(msg.value) || 1; } catch (e) {}
  } else if (msg.type === 'setSpeed') {
    try { speed = Number(msg.value) || 0.01; } catch (e) {}
  }
};
