// vj.ts - simple wrapper to create and manage the renderer worker + OffscreenCanvas
export async function createSimpleVJEngine(opts: { width?: number; height?: number; fps?: number } = {}) {
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const fps = opts.fps ?? 60;

  // Create a DOM canvas and transfer control to an OffscreenCanvas for the worker.
  // Capturing the stream from the DOM canvas ensures the preview video shows the worker's output.
  const domCanvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
  if (domCanvas) {
    domCanvas.width = width;
    domCanvas.height = height;
    domCanvas.style.width = width + 'px';
    domCanvas.style.height = height + 'px';
  }

  const offscreen = domCanvas ? (domCanvas as any).transferControlToOffscreen() as OffscreenCanvas : new OffscreenCanvas(width, height);

  // Create worker
  const worker = new Worker(new URL('./renderer.worker.ts', import.meta.url), { type: 'module' });

  // Transfer the OffscreenCanvas to worker
  try {
    worker.postMessage({ type: 'init', canvas: offscreen, width, height, fps }, [offscreen as unknown as Transferable]);
  } catch (e) {
    // fallback: post without transfer
    worker.postMessage({ type: 'init', canvas: offscreen, width, height, fps });
  }

  // Capture stream from the DOM canvas if available; otherwise try offscreen.captureStream
  const stream = domCanvas && (domCanvas as any).captureStream ? (domCanvas as any).captureStream(fps) : ((offscreen as any).captureStream ? (offscreen as any).captureStream(fps) : null);

  return {
    offscreen,
    domCanvas,
    stream,
    setColor: (rgb: [number, number, number]) => {
      try { worker.postMessage({ type: 'setColor', color: rgb }); } catch (e) {}
    },
    setMultiplier: (v: number) => { try { worker.postMessage({ type: 'setMultiplier', value: v }); } catch (e) {} },
    setSpeed: (v: number) => { try { worker.postMessage({ type: 'setSpeed', value: v }); } catch (e) {} },
  setAudioLevel: (v: number) => { try { worker.postMessage({ type: 'setAudioLevel', value: v }); } catch (e) {} },
    resize: (w: number, h: number) => {
      try {
        if (offscreen) {
          offscreen.width = w;
          offscreen.height = h;
        }
        worker.postMessage({ type: 'resize', width: w, height: h });
      } catch (e) {}
    },
    dispose: () => {
      try { worker.postMessage({ type: 'dispose' }); } catch (e) {}
      try { stream?.getTracks?.forEach((t: MediaStreamTrack) => t.stop()); } catch (e) {}
      try { worker.terminate(); } catch (e) {}
      // If a DOM canvas was created, remove it from DOM and clear references
      try {
        if (domCanvas && (domCanvas as any).parentNode) {
          (domCanvas as any).parentNode.removeChild(domCanvas);
        }
      } catch (e) {}
    }
  };
}
