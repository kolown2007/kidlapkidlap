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

// Simple VJ worker engine (OffscreenCanvas)
let vjEngine: any = null;
let vjPreviewContainer: HTMLDivElement;
let previewBabylonSetup: SceneSetup | null = null;
let previewActive = false;

let value = 3;
let sliderMult = 1;
let pendingMultiplier: number | null = null;

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

  // Get stream from the main canvas
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

function stopPreview() {
  // Stop worker stream and terminate worker
  try {
    if (vjEngine) {
      try { vjEngine.dispose(); } catch (e) {}
      try { vjEngine.stream?.getTracks?.().forEach((t: any) => t.stop()); } catch (e) {}
      vjEngine = null;
    }
  } catch (e) {}

  // Remove preview DOM and show placeholder
  try {
    if (vjPreviewContainer) {
      vjPreviewContainer.innerHTML = '<span class="text-gray-400 text-sm">Preview stopped</span>';
    }
  } catch (e) {}

  // Dispose any fallback Babylon preview
  try {
    if (previewBabylonSetup) {
      previewBabylonSetup.dispose();
      previewBabylonSetup = null;
    }
  } catch (e) {}
}

async function togglePreview() {
  if (previewActive) {
    stopPreview();
    previewActive = false;
    return;
  }

  // Start preview path (reuse existing Start Preview logic)
  try {
    if (!vjEngine) {
      try {
        vjEngine = await createSimpleVJEngine({ width: 1280, height: 720, fps: 60 });
      } catch (e) {
        console.warn('createSimpleVJEngine failed, falling back to local preview', e);
      }
    }

  // apply any pending multiplier from the tweakpane
  try { if (pendingMultiplier != null && vjEngine && typeof vjEngine.setMultiplier === 'function') { vjEngine.setMultiplier(pendingMultiplier); pendingMultiplier = null; } } catch (e) {}

    // attach stream if available
    if (vjPreviewContainer) {
      const attachStream = (stream: MediaStream) => {
        vjPreviewContainer.innerHTML = '';
        const vid = document.createElement('video');
        vid.autoplay = true; vid.playsInline = true; vid.muted = true;
        vid.width = 320; vid.height = 180;
        vid.srcObject = stream;
        vjPreviewContainer.appendChild(vid);
      };

      if (vjEngine && vjEngine.stream instanceof MediaStream) {
        attachStream(vjEngine.stream);
        previewActive = true;
        return;
      }

      try {
        const off = vjEngine?.offscreen as any;
        if (off && typeof off.captureStream === 'function') {
          const s = off.captureStream ? off.captureStream(60) : null;
          if (s) {
            attachStream(s as MediaStream);
            previewActive = true;
            return;
          }
        }
      } catch (e) {}
    }

    // fallback: local Babylon preview
    if (vjPreviewContainer && !previewBabylonSetup) {
      vjPreviewContainer.innerHTML = '';
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = 320; smallCanvas.height = 180;
      smallCanvas.style.width = '320px';
      smallCanvas.style.height = '180px';
      vjPreviewContainer.appendChild(smallCanvas);
      previewBabylonSetup = createBabylonScene(smallCanvas);
      startRenderLoop(previewBabylonSetup.engine, previewBabylonSetup.scene, previewBabylonSetup.torus, () => {
        const meterValue = meter?.getValue ? meter.getValue() : 0;
        const volume = Array.isArray(meterValue) ? meterValue[0] : meterValue;
        return { volume, value };
      });
      previewActive = true;
    }
  } catch (e) {
    console.warn('togglePreview failed', e);
  }
}

onMount(() => {
    // Setup Tweakpane via helper
    const tp = initTweakpane(tweakpaneContainer, { multiplier: 3, micActive: false }, {
  onSlider(v) { value = v; if (vjEngine && typeof vjEngine.setMultiplier === 'function') { vjEngine.setMultiplier(0.5 + ((v/9)*1.5)); } else { pendingMultiplier = 0.5 + ((v/9)*1.5); } },
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

  // NOTE: main Babylon background removed — we keep the audio meter for controls
  meter = getMeter();

    return () => {
  try { tp.dispose(); } catch (e) {}
  try { disposeAudio(); } catch (e) {}
  try { if (babylonSetup) (babylonSetup as any).dispose(); } catch (e) {}
  try { previewBabylonSetup?.dispose(); } catch (e) {}
    };
});
</script>

<main class="relative bg-black h-screen w-screen overflow-hidden">
    <!-- Canvas as background -->
    <canvas
        bind:this={canvas}
        class="absolute top-0 left-0 w-full h-full z-0"
        style="background: #222;"
    ></canvas>

  <!-- UI Layout with responsive divisions: 1 col on small screens, 2 cols on md+ -->
  <div class="relative z-10 h-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        
        <!-- Left Panel: Tweakpane Controls -->
        <div class="bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 flex flex-col overflow-auto min-h-0">
            <h2 class="text-lg font-semibold text-white mb-4">Controls</h2>
            <div bind:this={tweakpaneContainer} class="overflow-auto max-h-[60vh]"></div>
        </div>

  <!-- Center Panel removed (controls and media remain) -->

    <!-- Right Panel: Additional Controls/Info -->
    <div class="bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 flex flex-col overflow-auto min-h-0">
            <h2 class="text-lg font-semibold text-white mb-4">Media</h2>
            <div class="text-white text-sm">
        <p class="mb-2">Output: Offscreen preview + projection</p>
        <div bind:this={vjPreviewContainer} class="bg-black rounded border border-gray-500" style="width:320px; height:180px; display:flex; align-items:center; justify-content:center">
          <span class="text-gray-400 text-sm">Preview initializing...</span>
        </div>
        <div class="mt-3 flex space-x-2">
          <button on:click={togglePreview} class="px-3 py-2 text-white rounded" style="background-color: {previewActive ? '#dc2626' : '#16a34a'};">
            {previewActive ? 'Stop Preview' : 'Start Preview'}
          </button>

          <button on:click={() => {
            if (!vjEngine) return;
            const popup = window.open('/third-canvas', '_blank', 'width=1280,height=720');
            if (!popup) return;
            const stream = vjEngine.stream;
            const attachInterval = setInterval(() => {
              try {
                if (popup.closed) {
                  clearInterval(attachInterval);
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
          }} class="px-3 py-2 bg-blue-600 text-white rounded">Open Projection</button>
        </div>
            </div>
        </div>

    </div>
</main>
