<script lang="ts">
import { onMount } from 'svelte';
import { initTweakpane } from '$lib/tweakpane';
import { createBabylonScene, startRenderLoop, type SceneSetup } from '$lib/babylonScene';
import { createSimpleVJEngine } from '$lib/vj';
import { startMic, stopMic, getMeter, disposeAudio, isMicActive } from '$lib/audio';

let canvas: HTMLCanvasElement;
let tweakpaneContainer: HTMLDivElement;
let babylonSetup: SceneSetup | null = null;
let micActive = false;
let meter: any;
let _lastAudioSent = 0;
const _audioThrottleMs = 100; // only send audio level to worker at most every 100ms

// Simple VJ worker engine (OffscreenCanvas)
let vjEngine: any = null;
let vjPreviewContainer: HTMLElement;
let previewBabylonSetup: SceneSetup | null = null;
let previewActive = false;
let previewStream: MediaStream | null = null;

let value = 3;
let sliderMult = 1;
let pendingMultiplier: number | null = null;
// Throttle slider updates to the worker (30 Hz ~= 33ms)
const _throttleMs = 33;
let _lastSent = 0;
let _throttleTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSendMultiplier(rawValue: number) {
  const scaled = 0.5 + ((rawValue / 9) * 1.5);
  // Apply immediately to main-thread Babylon for low-latency feedback
  try {
    if (babylonSetup && babylonSetup.torus) {
      babylonSetup.torus.scaling.x = scaled;
      babylonSetup.torus.scaling.y = scaled;
      babylonSetup.torus.scaling.z = scaled;
    } else {
      // if no main-thread scene yet, keep pending
      pendingMultiplier = scaled;
    }
  } catch (e) {
    pendingMultiplier = scaled;
  }

  // If worker not ready, don't block; we'll send when ready
  if (!vjEngine) { return; }

  const now = Date.now();
  const sendNow = () => {
    try { if (vjEngine && typeof vjEngine.setMultiplier === 'function') vjEngine.setMultiplier(scaled); } catch (e) {}
    _lastSent = Date.now();
    _throttleTimer = null;
  };

  if (!_lastSent || (now - _lastSent) >= _throttleMs) {
    sendNow();
  } else {
    // schedule next send to align with throttle interval
    if (_throttleTimer) clearTimeout(_throttleTimer);
    _throttleTimer = setTimeout(sendNow, _throttleMs - (now - _lastSent));
  }
}

// Helpers to programmatically set the canvas backing resolution and to restore to preview size
function setCanvasBackingSize(width: number, height: number) {
  try {
    if (!canvas) return;
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      try { babylonSetup?.engine?.resize(); } catch (e) {}
    }
  } catch (e) {}
}

function restoreCanvasToPreview() {
  try {
    if (!vjPreviewContainer || !canvas) return;
    setCanvasBackingSize(vjPreviewContainer.clientWidth, vjPreviewContainer.clientHeight);
  } catch (e) {}
}

// Derived reactive slider multiplier (Svelte reactive declaration)
$: sliderMult = (() => {
  const sliderMin = 0;
  const sliderMax = 9;
  const sliderMinMult = 0.5;
  const sliderMaxMult = 2;
  // guard against divide-by-zero
  const range = sliderMax - sliderMin || 1;
  return sliderMinMult + ((value - sliderMin) / range) * (sliderMaxMult - sliderMinMult);
})();



// Audio is handled in src/lib/audio.ts

function openSecondCanvasWindow() {
  const popup = window.open('/second-canvas', '_blank', 'width=1280,height=720');
  if (!popup) return;

  // Get stream from the preview canvas
  if (!canvas || typeof canvas.captureStream !== 'function') return;
  const stream = canvas.captureStream(60); // 60 fps for smooth VJ performance
  
  // Wait for popup to load, then attach stream
  const attachInterval = setInterval(() => {
    try {
      if (popup.closed) {
        clearInterval(attachInterval);
        // Stop stream tracks when popup closes
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      
      const video = popup.document.getElementById('projection-video');
      if (video) {
        (video as HTMLVideoElement).srcObject = stream;
        (video as HTMLVideoElement).play().catch(() => {}); // Handle autoplay restrictions
        clearInterval(attachInterval);
        
        // Cleanup when popup closes
        const watcher = setInterval(() => {
          if (popup.closed) {
            stream.getTracks().forEach(t => t.stop());
            clearInterval(watcher);
          }
        }, 500);
      }
    } catch (e) {
      // Popup still loading or cross-origin, keep trying
    }
  }, 200);
}

function openProjectionWindow() {
  const popup = window.open('/third-canvas', '_blank', 'width=1280,height=720');
  if (!popup) return;
  if (!canvas || typeof canvas.captureStream !== 'function') return;

  // Try to size the canvas backing to the popup's inner size (or fallback to 1280x720)
  try {
    const targetW = popup.innerWidth || 1280;
    const targetH = popup.innerHeight || 720;
    setCanvasBackingSize(targetW, targetH);
  } catch (e) {}

  const stream = canvas.captureStream(60);
  const attachInterval = setInterval(() => {
    try {
      if (popup.closed) {
        clearInterval(attachInterval);
        // Stop stream tracks when popup closes
        if (stream) stream.getTracks().forEach(t => t.stop());
        // restore preview backing
        try { restoreCanvasToPreview(); } catch (e) {}
        return;
      }
      const video = popup.document.getElementById('mirror');
      if (video) {
        (video as HTMLVideoElement).srcObject = stream;
        (video as HTMLVideoElement).play().catch(() => {});
        clearInterval(attachInterval);
      }
    } catch (e) {
      // popup not ready
    }
  }, 200);
}

function stopPreview() {
  // Stop worker stream and terminate worker
  try {
    if (vjEngine) {
      try { vjEngine.dispose(); } catch (e) {}
      try { vjEngine.stream?.getTracks?.().forEach((t: any) => t.stop()); } catch (e) {}
      vjEngine = null;
    }
  } catch (e) {}

  // Remove preview DOM and show placeholder (remove any video or canvas)
  try {
    if (vjPreviewContainer) {
      try {
        const videos = (vjPreviewContainer as HTMLElement).querySelectorAll('video');
        videos.forEach((v) => {
          try { (v as HTMLVideoElement).pause(); } catch (e) {}
          try { (v as HTMLVideoElement).srcObject = null; } catch (e) {}
          try { v.remove(); } catch (e) {}
        });
      } catch (e) {}
      try {
        if (canvas && canvas.parentElement === vjPreviewContainer) {
          try { canvas.remove(); } catch (e) {}
        }
      } catch (e) {}
      vjPreviewContainer.innerHTML = '<span class="text-gray-400 text-sm">Preview stopped</span>';
    }
  } catch (e) {}

  // Dispose any fallback Babylon preview
  try {
    if (previewBabylonSetup) {
      previewBabylonSetup.dispose();
      previewBabylonSetup = null;
    }
    // dispose main-thread Babylon if present
    if (babylonSetup) {
      try { babylonSetup.dispose(); } catch (e) {}
      babylonSetup = null;
    }
    // stop preview stream tracks
    try {
      if (previewStream) {
        previewStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
        previewStream = null;
      }
    } catch (e) {}
  } catch (e) {}
}

async function togglePreview() {
  if (previewActive) {
    stopPreview();
    previewActive = false;
    return;
  }

  try {
    if (!vjPreviewContainer) return;
    // Ensure the canvas is in the preview container
    if (canvas && canvas.parentElement !== vjPreviewContainer) {
      vjPreviewContainer.innerHTML = '';
      vjPreviewContainer.appendChild(canvas);
    }

    // Ensure Babylon scene exists and is running
    if (!babylonSetup) {
      try {
        babylonSetup = createBabylonScene(canvas);
        startRenderLoop(babylonSetup.engine, babylonSetup.scene, babylonSetup.torus, () => {
          const meterValue = meter?.getValue ? meter.getValue() : 0;
          const volume = Array.isArray(meterValue) ? meterValue[0] : meterValue;
          return { volume, value };
        });
      } catch (e) {
        console.warn('Failed to init preview Babylon scene', e);
      }
    }

    // apply pending multiplier if any
    try { if (pendingMultiplier != null && babylonSetup) { babylonSetup.torus.scaling.x = pendingMultiplier; babylonSetup.torus.scaling.y = pendingMultiplier; babylonSetup.torus.scaling.z = pendingMultiplier; pendingMultiplier = null; } } catch (e) {}

    previewActive = true;
  } catch (e) {
    console.warn('togglePreview failed', e);
  }
}

onMount(() => {
    // Initialize audio meter early so render loop can read it
    meter = getMeter();

    // Create an internal HD canvas inside the preview container and initialize Babylon on it.
    // Declare ResizeObserver and resize function here so they are visible to the cleanup closure
    let ro: ResizeObserver | null = null;
    const resizeCanvasToContainer = () => {
      try {
        if (!vjPreviewContainer || !canvas) return;
        const dpr = Math.max(window.devicePixelRatio || 1, 1);
        const w = Math.max(1, Math.floor(vjPreviewContainer.clientWidth * dpr));
        const h = Math.max(1, Math.floor(vjPreviewContainer.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          try { babylonSetup?.engine?.resize(); } catch (e) {}
        }
      } catch (e) {}
    };

    try {
      // Create the rendering canvas (HD internal resolution). We'll size it via CSS to fit the preview button.
      canvas = document.createElement('canvas') as HTMLCanvasElement;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvas.style.objectFit = 'cover';

      // Append canvas into preview container (replace placeholder content)
      if (vjPreviewContainer) {
        vjPreviewContainer.innerHTML = '';
        vjPreviewContainer.appendChild(canvas);
      }

      // Resize canvas backing to container pixel size * DPR so captureStream and projection get HD frames
      try {
        ro = new ResizeObserver(resizeCanvasToContainer);
        ro.observe(vjPreviewContainer);
        window.addEventListener('resize', resizeCanvasToContainer);
      } catch (e) {}

      // initial sizing
      resizeCanvasToContainer();

      babylonSetup = createBabylonScene(canvas);
      startRenderLoop(babylonSetup.engine, babylonSetup.scene, babylonSetup.torus, () => {
        const meterValue = meter?.getValue ? meter.getValue() : 0;
        const volume = Array.isArray(meterValue) ? meterValue[0] : meterValue;
        return { volume, value };
      });

      // If there was a pending multiplier from controls, apply it now
      try { if (pendingMultiplier != null && babylonSetup) { babylonSetup.torus.scaling.x = pendingMultiplier; babylonSetup.torus.scaling.y = pendingMultiplier; babylonSetup.torus.scaling.z = pendingMultiplier; pendingMultiplier = null; } } catch (e) {}
    } catch (e) {
      console.warn('Failed to init main Babylon scene inside preview', e);
    }

    // Setup Tweakpane via helper
    const tp = initTweakpane(tweakpaneContainer, { multiplier: 3, micActive: false }, {
  onSlider(v) { value = v; scheduleSendMultiplier(v); },
        onMicToggle: async (on) => {
            if (on && !micActive) {
                await startMic();
                micActive = isMicActive();
            } else if (!on && micActive) {
                await stopMic();
                micActive = isMicActive();
            }
        }
    });

    return () => {
  try { tp.dispose(); } catch (e) {}
  try { disposeAudio(); } catch (e) {}
  try { if (babylonSetup) (babylonSetup as any).dispose(); } catch (e) {}
  try { previewBabylonSetup?.dispose(); } catch (e) {}
  try { if (canvas && canvas.parentElement) canvas.parentElement.removeChild(canvas); } catch (e) {}
  try { if (ro && vjPreviewContainer) { ro.unobserve(vjPreviewContainer); ro = null; } } catch (e) {}
  try { window.removeEventListener('resize', resizeCanvasToContainer); } catch (e) {}
    };
});

// mic test removed — use the Mic control in Tweakpane instead
</script>

<main class="relative bg-black h-screen w-screen overflow-hidden">

  <!-- UI Layout with responsive divisions: 1 col on small screens, 2 cols on md+ -->
  <div class="relative z-10 h-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        
        <!-- Left Panel: Tweakpane Controls + Preview -->
        <div class="bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 flex flex-col overflow-auto min-h-0">
           
            <div class="mb-3">
              <button bind:this={vjPreviewContainer} type="button" aria-label="Preview area" class="bg-gray-900 rounded border border-gray-700 w-full aspect-[16/9] overflow-hidden cursor-pointer p-0" style="display:flex; align-items:center; justify-content:center">
                <span class="text-gray-400 text-sm">Preview initializing...</span>
              </button>
            </div>
            <div bind:this={tweakpaneContainer} class="overflow-auto max-h-[60vh]"></div>
            <div class="mt-3">
              <div class="text-white text-sm">
               
                <div class="mt-3 flex space-x-2">
                  <button on:click={togglePreview} class="px-3 py-2 rounded text-white bg-gray-800 border border-gray-700 hover:bg-gray-700 focus:outline-none">
                    {previewActive ? 'Stop Preview' : 'Start Preview'}
                  </button>

                  <button on:click={openProjectionWindow} class="px-3 py-2 rounded text-white bg-gray-800 border border-gray-700 hover:bg-gray-700 focus:outline-none">Open Projection</button>
                </div>
              </div>
            </div>
            <!-- Mic test removed; use the Mic control in Tweakpane -->
        </div>

    </div>
</main>
