<script lang="ts">
import { onMount } from 'svelte';
import type { SceneSetup } from '$lib/babylonScene';
import { createSceneController } from '$lib/sceneController';
import { Color4 } from '@babylonjs/core';
import { startMic, stopMic, getMeter, disposeAudio, isMicActive } from '$lib/audio';
import { createPreviewController } from '$lib/previewController';
import { createTweakpaneController } from '$lib/tweakpaneController';
import { createProjectionController } from '$lib/projectionController';
import { createVJController } from '$lib/vjController';

let canvas: HTMLCanvasElement | undefined;
let tweakpaneContainer: HTMLDivElement | undefined;
let babylonSetup: SceneSetup | null = null;
const sceneController = createSceneController();
let micActive = false;
let meter: any;

const vj = createVJController({ throttleMs: 33 });
let vjPreviewContainer: HTMLElement | undefined;
let previewActive = false;
let preview: ReturnType<typeof createPreviewController> | null = null;
let previewStream: MediaStream | null = null;
let projectionController: ReturnType<typeof createProjectionController> | null = null;
let preferSecondScreen = false;
let projectionOpen = false;

let value = 3;
let sliderMult = 1;
let pendingMultiplier: number | null = null;

const FIXED_BACKING_W = 1280;
const FIXED_BACKING_H = 720;

function scheduleSendMultiplier(rawValue: number) {
  const scaled = 0.5 + ((rawValue / 9) * 1.5);
  try { sceneController.setMultiplier(scaled); } catch (e) { pendingMultiplier = scaled; }
  try { vj.setMultiplier(scaled); } catch (e) {}
}

$: sliderMult = (() => {
  const sliderMin = 0, sliderMax = 9, sliderMinMult = 0.5, sliderMaxMult = 2;
  const range = sliderMax - sliderMin || 1;
  return sliderMinMult + ((value - sliderMin) / range) * (sliderMaxMult - sliderMinMult);
})();

function openSecondCanvasWindow() {
  const popup = window.open('/second-canvas', '_blank', 'width=1280,height=720');
  if (!popup) return;
  if (!canvas || typeof canvas.captureStream !== 'function') return;
  const stream = canvas.captureStream(60);
  const attachInterval = setInterval(() => {
    try {
      if (popup.closed) { clearInterval(attachInterval); stream.getTracks().forEach(t => t.stop()); return; }
      const video = popup.document.getElementById('projection-video');
      if (video) { (video as HTMLVideoElement).srcObject = stream; (video as HTMLVideoElement).play().catch(()=>{}); clearInterval(attachInterval); const watcher = setInterval(()=>{ if (popup.closed) { stream.getTracks().forEach(t=>t.stop()); clearInterval(watcher); } }, 500); }
    } catch (e) {}
  }, 200);
}

async function toggleProjection() {
  try {
    if (!canvas) return null;
    if (!projectionController) {
      projectionController = createProjectionController({ width: FIXED_BACKING_W, height: FIXED_BACKING_H, fps: 60 });
      try { projectionController.setOnChange?.((open: boolean) => { projectionOpen = !!open; }); } catch (e) {}
    }
    return await projectionController.toggle(canvas, preferSecondScreen);
  } catch (e) {
    console.warn('toggleProjection failed', e);
    return null;
  }
}

function stopPreview() {
  try { vj.dispose(); } catch (e) {}
  try { preview?.dispose?.(); } catch (e) {}
  preview = null;
  try { sceneController.dispose(); } catch (e) {}
  babylonSetup = null;
  previewActive = false;
}

async function togglePreview() {
  if (previewActive) { stopPreview(); previewActive = false; return; }
  try {
    if (!vjPreviewContainer) return;
    if (!preview) {
      preview = createPreviewController(vjPreviewContainer ?? null, () => {
        const meterValue = meter?.getValue ? meter.getValue() : 0;
        const volume = Array.isArray(meterValue) ? meterValue[0] : meterValue;
        return { volume, value };
      }, { fixedWidth: FIXED_BACKING_W, fixedHeight: FIXED_BACKING_H, shouldSkipResize: () => false });
    }
    try { preview.start(); } catch (e) {}
    try { canvas = preview.getCanvas() ?? canvas; } catch (e) {}
    try { babylonSetup = preview.getSceneSetup() ?? babylonSetup; sceneController.setSceneSetup(babylonSetup); } catch (e) {}
    if (pendingMultiplier != null) { try { sceneController.setMultiplier(pendingMultiplier); pendingMultiplier = null; } catch (e) {} }
    previewActive = true;
  } catch (e) {
    console.warn('togglePreview failed', e);
  }
}

onMount(() => {
  meter = getMeter();
  try {
    preview = createPreviewController(vjPreviewContainer ?? null, () => {
      const meterValue = meter?.getValue ? meter.getValue() : 0;
      const volume = Array.isArray(meterValue) ? meterValue[0] : meterValue;
      return { volume, value };
    }, { fixedWidth: FIXED_BACKING_W, fixedHeight: FIXED_BACKING_H, shouldSkipResize: () => false });
    try { preview.start(); } catch (e) {}
    try { canvas = preview.getCanvas() ?? canvas; } catch (e) {}
    try { babylonSetup = preview.getSceneSetup() ?? babylonSetup; sceneController.setSceneSetup(babylonSetup); } catch (e) {}
  } catch (e) {
    console.warn('Failed to init preview controller', e);
  }

  const tp = createTweakpaneController(tweakpaneContainer ?? null, { multiplier: 3, micActive: false, wireframe: false, backgroundColor: '#000000', preferSecondScreen: false }, {
    applyMultiplier: (v) => { value = v; scheduleSendMultiplier(v); },
    onMicToggle: async (on) => {
      if (on && !micActive) { await startMic(); micActive = isMicActive(); }
      else if (!on && micActive) { await stopMic(); micActive = isMicActive(); }
    },
    setWireframe: (on) => { try { sceneController.setWireframe(!!on); } catch (e) {} },
    setBackgroundColor: (color) => { try { if (canvas) canvas.style.background = color; sceneController.setBackgroundColor(color); } catch (e) {} },
    setPreferSecondScreen: (on) => { preferSecondScreen = !!on; }
  });

  return () => {
    try { tp.dispose(); } catch (e) {}
    try { disposeAudio(); } catch (e) {}
    try { preview?.dispose?.(); } catch (e) {}
    try { sceneController.dispose(); } catch (e) {}
  };
});
</script>

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

                  <button on:click={toggleProjection} class="px-3 py-2 rounded text-white bg-gray-800 border border-gray-700 hover:bg-gray-700 focus:outline-none">{projectionOpen ? 'Close Projection' : 'Open Projection'}</button>
                </div>
              </div>
            </div>
            
        </div>

  </div>
