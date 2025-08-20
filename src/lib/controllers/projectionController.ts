import type { ProjectionHandle } from '../projection';
import { createProjection } from '../projection';

export type ProjectionControllerOptions = {
  width?: number;
  height?: number;
  fps?: number;
  onChange?: (open: boolean) => void;
};

export function createProjectionController(opts: ProjectionControllerOptions = {}) {
  let handle: ProjectionHandle | null = null;
  let popup: Window | null = null;
  let fixedW = opts.width ?? 1280;
  let fixedH = opts.height ?? 720;
  let fps = opts.fps ?? 60;
  let onChange: ((open: boolean) => void) | null = opts.onChange ?? null;
  let popupWatcher: ReturnType<typeof setInterval> | null = null;

  async function computePopupCoords(preferSecondScreen: boolean) {
    let left: number | undefined = undefined;
    let top: number | undefined = undefined;
    let width = fixedW;
    let height = fixedH;
    try {
      if (preferSecondScreen) {
        const maybeGetScreens = (window as any).getScreenDetails;
        if (typeof maybeGetScreens === 'function') {
          try {
            const sd = (window as any).getScreenDetails();
            const details = (sd && typeof sd.then === 'function') ? await sd : sd;
            const screens = details && details.screens;
            if (screens && screens.length > 1) {
              const other = screens.find((s: any) => !s.isPrimary) || screens[1];
              left = other.availLeft ?? other.left ?? other.x ?? other.availX;
              top = other.availTop ?? other.top ?? other.y ?? other.availY;
              width = other.availWidth ?? other.width ?? other.availW ?? width;
              height = other.availHeight ?? other.height ?? other.availH ?? height;
            }
          } catch (e) {
            // fall through to fallback
          }
        } else if ((window as any).screen && (window as any).screen.availWidth) {
          try {
            const sw = (window as any).screen.availWidth;
            const sh = (window as any).screen.availHeight;
            left = sw + 50;
            top = 50;
            width = Math.min(width, Math.floor(sw));
            height = Math.min(height, Math.floor(sh));
          } catch (e) {}
        }
      }
    } catch (e) {}
    return { left, top, width, height };
  }

  async function open(canvas: HTMLCanvasElement | null, preferSecondScreen = false) {
    if (!canvas) return null;
    try {
      const coords = await computePopupCoords(preferSecondScreen);
      let features = `width=${coords.width},height=${coords.height}`;
      if (typeof coords.left === 'number' && typeof coords.top === 'number') features += `,left=${coords.left},top=${coords.top}`;

      const pop = window.open('/third-canvas', '_blank', features);
      if (!pop) return null;
      popup = pop;
      onChange?.(true);

      // start an internal watcher to observe popup close and notify onChange
      if (popupWatcher) { clearInterval(popupWatcher); popupWatcher = null; }
      popupWatcher = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            onChange?.(false);
            if (popupWatcher) { clearInterval(popupWatcher); popupWatcher = null; }
          }
        } catch (e) {}
      }, 500);

      if (!handle) handle = createProjection(fixedW, fixedH, fps);
      const stream = handle.start(canvas);
      if (!stream) return null;

      const attachInterval = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            clearInterval(attachInterval);
            try { handle?.stop(); } catch (e) {}
            try { handle?.dispose(); } catch (e) {}
            handle = null;
            popup = null;
            return;
          }
          const video = popup.document.getElementById('mirror') || popup.document.getElementById('projection-video');
          if (video) {
            (video as HTMLVideoElement).srcObject = stream;
            (video as HTMLVideoElement).play().catch(() => {});
            clearInterval(attachInterval);
          }
        } catch (e) {
          // popup may not be ready yet
        }
      }, 200);

      return popup;
    } catch (e) {
      try { handle?.stop(); } catch (e) {}
      try { handle?.dispose(); } catch (e) {}
      handle = null;
      popup = null;
  onChange?.(false);
      return null;
    }
  }

  async function reattach(newCanvas: HTMLCanvasElement | null) {
    try {
      if (!popup || popup.closed) return null;
      if (!handle) handle = createProjection(fixedW, fixedH, fps);
      // stop previous copy loop and start with new source
      try { handle.stop(); } catch (e) {}
      const stream = handle.start(newCanvas as HTMLCanvasElement);
      if (!stream) return null;

      // attach to video element in popup
      const attachInterval = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            clearInterval(attachInterval);
            return;
          }
          const video = popup.document.getElementById('mirror') || popup.document.getElementById('projection-video');
          if (video) {
            (video as HTMLVideoElement).srcObject = stream;
            (video as HTMLVideoElement).play().catch(() => {});
            clearInterval(attachInterval);
          }
        } catch (e) {
          // popup may not be ready
        }
      }, 200);

      return popup;
    } catch (e) {
      return null;
    }
  }

  function close() {
    try {
      if (popup && !popup.closed) try { popup.close(); } catch (e) {}
    } catch (e) {}
    try { handle?.stop(); } catch (e) {}
    try { handle?.dispose(); } catch (e) {}
    handle = null;
    popup = null;
  try { if (popupWatcher) { clearInterval(popupWatcher); popupWatcher = null; } } catch (e) {}
  onChange?.(false);
  }

  async function toggle(canvas: HTMLCanvasElement | null, preferSecondScreen = false) {
    try {
      if (popup && !popup.closed) {
        close();
        return null;
      }
      return await open(canvas, preferSecondScreen);
    } catch (e) {
      return null;
    }
  }

  function isOpen() {
    try { return !!(popup && !popup.closed); } catch (e) { return false; }
  }

  function setOnChange(cb: ((open: boolean) => void) | null) { onChange = cb; }

  return { open, close, toggle, isOpen, getPopup: () => popup, setOnChange, reattach } as const;
}

export default createProjectionController;
