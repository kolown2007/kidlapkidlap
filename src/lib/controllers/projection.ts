export interface ProjectionHandle {
  start: (sourceCanvas: HTMLCanvasElement) => MediaStream | null;
  stop: () => void;
  getStream: () => MediaStream | null;
  dispose: () => void;
  getCanvas: () => HTMLCanvasElement | null;
}

export function createProjection(fixedW: number, fixedH: number, fps = 60): ProjectionHandle {
  let canvas: HTMLCanvasElement | null = document.createElement('canvas');
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = Math.max(1, Math.floor(fixedW * dpr));
  canvas.height = Math.max(1, Math.floor(fixedH * dpr));
  canvas.style.width = `${fixedW}px`;
  canvas.style.height = `${fixedH}px`;

  let ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
  let raf: number | null = null;
  let stream: MediaStream | null = null;

  function copyLoop(source: HTMLCanvasElement) {
    if (!canvas || !ctx) return;
    try {
      // Only draw when source has positive backing size
      if (source.width > 0 && source.height > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      }
    } catch (e) {
      // ignore transient drawing errors
    }
    raf = requestAnimationFrame(() => copyLoop(source));
  }

  function start(sourceCanvas: HTMLCanvasElement) {
    if (!canvas) return null;
    if (!ctx) ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (!raf) raf = requestAnimationFrame(() => copyLoop(sourceCanvas));
    try {
      if (stream) {
        try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
        stream = null;
      }
      stream = canvas.captureStream(fps);
    } catch (e) {
      stream = null;
    }
    return stream;
  }

  function stop() {
    try {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    } catch (e) {}
    try {
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    } catch (e) {}
  }

  function getStream() { return stream; }
  function getCanvas() { return canvas; }

  function dispose() {
    stop();
    try { ctx = null; } catch (e) {}
    try { if (canvas && canvas.parentElement) canvas.parentElement.removeChild(canvas); } catch (e) {}
    try { canvas = null; } catch (e) {}
  }

  return { start, stop, getStream, dispose, getCanvas };
}
