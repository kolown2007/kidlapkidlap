// canvasUtils.ts
// Small helper utilities for managing a canvas pixel backing size (DPR-aware).
export function setCanvasBackingSize(canvas: HTMLCanvasElement | null, width: number, height: number, engine: { resize?: () => void } | null = null) {
  if (!canvas) return;
  try {
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      try { engine?.resize?.(); } catch (e) {}
    }
  } catch (e) {
    // swallow errors to keep callers simple
  }
}

export function restoreCanvasToPreview(canvas: HTMLCanvasElement | null, container: HTMLElement | null, engine: { resize?: () => void } | null = null) {
  if (!canvas || !container) return;
  setCanvasBackingSize(canvas, container.clientWidth, container.clientHeight, engine);
}

export default { setCanvasBackingSize, restoreCanvasToPreview };
