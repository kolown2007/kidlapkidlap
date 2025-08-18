<script lang="ts">
import { onMount } from 'svelte';
import { initTweakpane } from '$lib/tweakpane';
import { createBabylonScene, startRenderLoop, type SceneSetup } from '$lib/babylonScene';
import { startMic, stopMic, getMeter, disposeAudio, isMicActive } from '$lib/audio';

let canvas: HTMLCanvasElement;
let tweakpaneContainer: HTMLDivElement;
let babylonSetup: SceneSetup;
let micActive = false;
let meter: any;

let value = $state(3);

  // Derived rune for slider multiplier
  const sliderMult = $derived(() => {
      const sliderMin = 0;
      const sliderMax = 9;
      const sliderMinMult = 0.5;
      const sliderMaxMult = 2;
      return sliderMinMult + ((value - sliderMin) / (sliderMax - sliderMin)) * (sliderMaxMult - sliderMinMult);
  });



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

onMount(() => {
    // Setup Tweakpane via helper
    const tp = initTweakpane(tweakpaneContainer, { multiplier: 3, micActive: false }, {
        onSlider(v) { value = v; },
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

    // Setup Babylon.js scene
    babylonSetup = createBabylonScene(canvas);

    // Tone.js meter (shared)
    meter = getMeter();
    
    // Start render loop with audio data
    startRenderLoop(babylonSetup.engine, babylonSetup.scene, babylonSetup.torus, () => {
        const meterValue = meter.getValue();
        const volume = Array.isArray(meterValue) ? meterValue[0] : meterValue;
        return { volume, value };
    });

    return () => {
        try { tp.dispose(); } catch (e) {}
        try { disposeAudio(); } catch (e) {}
        babylonSetup.dispose();
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

    <!-- UI Layout with responsive divisions: 1 col on small screens, 3 cols on md+ -->
    <div class="relative z-10 h-full grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        
        <!-- Left Panel: Tweakpane Controls -->
        <div class="bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 flex flex-col overflow-auto min-h-0">
            <h2 class="text-lg font-semibold text-white mb-4">Controls</h2>
            <div bind:this={tweakpaneContainer} class="overflow-auto max-h-[60vh]"></div>
        </div>

    <!-- Center Panel: Main Content -->
    <div class="bg-gray-900/60 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center justify-center overflow-auto min-h-0">
            <h1 class="text-3xl font-bold text-white mb-6 text-center">Kidlap-Kidlap</h1>
            <div class="py-5 flex space-x-2">
                <button onclick={openSecondCanvasWindow} class="mb-2 px-4 py-2 bg-gray-600 text-white rounded">
                   Open Window
                </button>
            </div>
        </div>

    <!-- Right Panel: Additional Controls/Info -->
    <div class="bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 flex flex-col overflow-auto min-h-0">
            <h2 class="text-lg font-semibold text-white mb-4">Media</h2>
            <div class="text-white text-sm">
                <!-- <p>Drop zone for:</p>
                <ul class="list-disc list-inside mt-2 space-y-1">
                    <li>Images</li>
                    <li>Videos</li>
                    <li>GIFs</li>
                    <li>Shaders</li>
                </ul> -->
            </div>
        </div>

    </div>
</main>
