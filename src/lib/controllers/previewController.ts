// fully class-based scenes only: SceneDefinitions must provide a create(canvas, opts?) -> SceneInstance
import { setCanvasBackingSize } from '../core/canvasUtils';

export type RenderDataProvider = () => { volume: number; value: number };
export type PreviewControllerOptions = {
  fixedWidth?: number;
  fixedHeight?: number;
  fps?: number;
  shouldSkipResize?: () => boolean;
  /** Optional factory to create a scene (torus/sphere). Signature: (canvas) => SceneSetup-like */
  /** Optional class-based scene definition (new API) */
  sceneDef?: any;
  /** Optional render loop starter: (engine, scene, mesh, getAudioData) */
  startLoop?: (engine: any, scene: any, mesh: any, getAudioData: () => { volume: number; value: number }) => void;
};

export function createPreviewController(container: HTMLElement | null, renderDataProvider: RenderDataProvider, opts: PreviewControllerOptions = {}) {
  let canvas: HTMLCanvasElement | null = null;
  let ro: ResizeObserver | null = null;
  let babylonSetup: any | null = null;
  let sceneInstance: any = null;
  let previewActive = false;

  const fixedW = opts.fixedWidth ?? 1280;
  const fixedH = opts.fixedHeight ?? 720;

  function resizeCanvasToContainer() {
    try {
      if (opts.shouldSkipResize && opts.shouldSkipResize()) return;
      if (!container || !canvas) return;
      try { babylonSetup?.engine?.resize(); } catch (e) {}
    } catch (e) {}
  }

  async function start() {
    if (previewActive) return;
    if (!container) return;

    // create canvas
    canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.objectFit = 'cover';

    // set fixed backing so captureStream uses a stable resolution
    try { setCanvasBackingSize(canvas, fixedW, fixedH, babylonSetup?.engine ?? null); } catch (e) {}

    container.innerHTML = '';
    container.appendChild(canvas);

    try {
      ro = new ResizeObserver(resizeCanvasToContainer);
      ro.observe(container);
      window.addEventListener('resize', resizeCanvasToContainer);
    } catch (e) {}

    // initial sizing
    resizeCanvasToContainer();

    try {
      // Require class-based SceneDefinition: pass renderDataProvider via create opts
      if (opts.sceneDef && typeof opts.sceneDef.create === 'function') {
        try {
          const instance = await opts.sceneDef.create(canvas as HTMLCanvasElement, { renderDataProvider });
          sceneInstance = instance;
          // allow scene instance to init if it provides init()
          if (typeof (sceneInstance as any).init === 'function') {
            try { await (sceneInstance as any).init(); } catch (e) { /* swallow */ }
          }
          // start the scene's internal loop if it exposes start()
          try { if (typeof (sceneInstance as any).start === 'function') (sceneInstance as any).start(); } catch (e) { /* swallow */ }
          // expose legacy-style setup if the scene provides it (optional)
          babylonSetup = typeof sceneInstance?.getSetup === 'function' ? sceneInstance.getSetup() : null;
        } catch (e) {
          console.warn('previewController: failed to create class-based scene', e);
        }
      } else {
        console.warn('previewController: no class-based sceneDef provided; cannot initialize preview');
      }
    } catch (e) {
      console.warn('createPreviewController: failed to init Babylon scene', e);
    }

    previewActive = true;
  }

  function stop() {
    try {
      // dispose Babylon scene / instance if present
      if (sceneInstance) {
        try { if (typeof sceneInstance.dispose === 'function') sceneInstance.dispose(); } catch (e) {}
        sceneInstance = null;
      }
      if (babylonSetup) {
        try { (babylonSetup as any).dispose(); } catch (e) {}
        babylonSetup = null;
      }
    } catch (e) {}

    try {
      // stop any stream originating from the canvas (if captureStream was used)
      try {
        if (canvas && typeof (canvas as any).captureStream === 'function') {
          try {
            const s: MediaStream = (canvas as any).captureStream();
            if (s && s.getTracks) {
              s.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
            }
          } catch (e) {}
        }
      } catch (e) {}

      // stop and remove any <video> elements inside the container
      try {
        if (container) {
          const videos = container.querySelectorAll('video');
          videos.forEach(v => {
            try { (v as HTMLVideoElement).pause(); } catch (e) {}
            try { (v as HTMLVideoElement).srcObject = null; } catch (e) {}
            try { v.remove(); } catch (e) {}
          });
        }
      } catch (e) {}

      // remove canvas from DOM if present
      try {
        if (canvas && container && canvas.parentElement === container) {
          try { canvas.remove(); } catch (e) {}
        }
      } catch (e) {}

      // put a simple placeholder so the UI isn't empty
      try {
        if (container) container.innerHTML = '<span class="text-gray-400 text-sm">Preview stopped</span>';
      } catch (e) {}
    } catch (e) {}

    try {
      if (ro && container) { ro.unobserve(container); ro = null; }
    } catch (e) {}

    try { window.removeEventListener('resize', resizeCanvasToContainer); } catch (e) {}

    previewActive = false;
  }

  function dispose() {
    try { stop(); } catch (e) {}
    try { if (canvas) canvas = null; } catch (e) {}
  }

  return {
    start,
    stop,
    dispose,
    getCanvas: () => canvas,
  getSceneSetup: () => babylonSetup,
  getSceneInstance: () => sceneInstance,
  } as const;
}

export default createPreviewController;
