<script lang="ts">
import { onMount } from 'svelte';
// Using class-based SceneDefinitions only
import { Color4 } from '@babylonjs/core';
import {
  createSceneController,
  startMic,
  stopMic,
  getMeter,
  disposeAudio,
  isMicActive,
  createPreviewController,
  createTweakpaneController,
  createProjectionController,
  createVJController,
} from '$lib';
import { sceneMap } from '$lib/visuals/registry';

let canvas: HTMLCanvasElement | undefined;
let systemPaneContainer: HTMLDivElement | undefined;
let visualsPaneContainer: HTMLDivElement | undefined;
let babylonSetup: any | null = null;
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
let tp: ReturnType<typeof createTweakpaneController> | null = null;

let value = 3;
let sliderMult = 1;
let pendingMultiplier: number | null = null;
let currentSceneId: string = 'sphere';

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
  let opts: any = { fixedWidth: FIXED_BACKING_W, fixedHeight: FIXED_BACKING_H, shouldSkipResize: () => false };
  if (!preview) {
      // Prefer class-based SceneDefinitions for newer scenes
  // Use centralized sceneMap to locate a scene definition
  opts.sceneDef = sceneMap[currentSceneId] ?? sceneMap['sphere'];
    preview = createPreviewController(vjPreviewContainer ?? null, () => {
        const meterValue = meter?.getValue ? meter.getValue() : 0;
        const volume = Array.isArray(meterValue) ? meterValue[0] : meterValue;
        return { volume, value };
  }, opts);
    }
    try { await preview.start(); } catch (e) {}
    try { canvas = preview.getCanvas() ?? canvas; } catch (e) {}
    try { babylonSetup = preview.getSceneSetup() ?? babylonSetup; sceneController.setSceneSetup(babylonSetup); } catch (e) {}
    // If the scene is class-based, create an instance for tweakpane rebuild
    try {
      if (preview && typeof (preview as any).getSceneInstance === 'function' && tp && typeof tp.rebuildForScene === 'function') {
        try {
          const instance = (preview as any).getSceneInstance?.();
          if (instance) try { tp.rebuildForScene(opts.sceneDef, instance); } catch (e) {}
        } catch (e) {}
      }
    } catch (e) {}
    if (pendingMultiplier != null) { try { sceneController.setMultiplier(pendingMultiplier); pendingMultiplier = null; } catch (e) {} }
    previewActive = true;
  } catch (e) {
    console.warn('togglePreview failed', e);
  }
}

onMount(() => {
  (async () => {
  meter = getMeter();
  try {
  const opts: any = { fixedWidth: FIXED_BACKING_W, fixedHeight: FIXED_BACKING_H, shouldSkipResize: () => false };
  if (currentSceneId === 'sphere') { opts.sceneDef = sceneMap['sphere']; }
  
  
  preview = createPreviewController(vjPreviewContainer ?? null, () => {
      const meterValue = meter?.getValue ? meter.getValue() : 0;
      const volume = Array.isArray(meterValue) ? meterValue[0] : meterValue;
      return { volume, value };
  }, opts);
  try { await preview.start(); } catch (e) {}
    try { canvas = preview.getCanvas() ?? canvas; } catch (e) {}
    try { babylonSetup = preview.getSceneSetup() ?? babylonSetup; sceneController.setSceneSetup(babylonSetup); } catch (e) {}
  } catch (e) {
    console.warn('Failed to init preview controller', e);
  }

  tp = createTweakpaneController(systemPaneContainer ?? null, visualsPaneContainer ?? null, { preferSecondScreen: false }, {
    setPreferSecondScreen: (on: boolean) => { preferSecondScreen = !!on; },
  onSceneChange: async (id: string) => {
      try {
        if (id === currentSceneId) return;
        // Dispose current preview and scene for performance
        try { preview?.dispose?.(); } catch (e) {}
        try { sceneController.dispose(); } catch (e) {}
        preview = null;
        babylonSetup = null;
        // ensure state reflects stopped preview so togglePreview will start a fresh one
        previewActive = false;
        currentSceneId = id;
        // Start the newly selected scene
        try { await togglePreview(); } catch (e) {}
        // If a projection popup is open, reattach it to the new canvas
        try {
          if (projectionController && projectionController.isOpen && projectionController.isOpen()) {
            try { await projectionController.reattach?.(canvas ?? null); } catch (e) {}
          }
        } catch (e) {}
      } catch (e) {}
    }
    ,
    startPreview: () => { try { togglePreview(); } catch (e) {} },
    toggleProjection: () => { try { toggleProjection(); } catch (e) {} }
  });

  // If preview created a scene instance during init, rebuild the scene-specific controls now
  try {
    const instance = (preview as any)?.getSceneInstance ? (preview as any).getSceneInstance() : null;
    if (instance && tp && typeof tp.rebuildForScene === 'function') {
      try {
  const sceneDef = currentSceneId === 'sphere' ? sceneMap['sphere'] : (currentSceneId === 'marble' ? sceneMap['marble'] : sceneMap['sphere']);
        try { console.warn('rebuilding tweakpane for scene', { sceneId: sceneDef?.id, controls: sceneDef?.controls?.length ?? 0, hasApplyControl: typeof instance.applyControl === 'function' }); } catch (e) {}
        tp.rebuildForScene(sceneDef, instance);
      } catch (e) { console.warn('tp.rebuildForScene failed', e); }
    }
  } catch (e) {}

  return () => {
  try { tp?.dispose?.(); } catch (e) {}
    try { disposeAudio(); } catch (e) {}
    try { preview?.dispose?.(); } catch (e) {}
    try { sceneController.dispose(); } catch (e) {}
  };
  })();
});
</script>

  <div class="relative z-10 min-h-screen overflow-y-auto grid grid-cols-1 md:grid-cols-10 gap-4 p-4">

    <!-- Column 1: Preview (top) and System Controls (bottom) -->
  <div class="space-y-4 md:col-span-7">
      <div class="bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 flex flex-col overflow-auto min-h-0">
        <div class="mb-3">
          <button bind:this={vjPreviewContainer} type="button" aria-label="Preview area" class="bg-gray-900 rounded border border-gray-700 w-full aspect-[16/9] overflow-hidden cursor-pointer p-0" style="display:flex; align-items:center; justify-content:center">
            <span class="text-gray-400 text-sm">Preview initializing...</span>
          </button>
        </div>
          <!-- Placeholder terminal input (no function yet) -->
          <div class="mt-3 bg-black/60 border border-gray-800 rounded-md p-3 min-h-[56px]">
            <div class="text-gray-300 text-xs mb-2">Live Coding</div>
            <div class="flex items-center">
              <span class="text-green-400 font-mono mr-2">&gt;</span>
              <input type="text" aria-label="terminal-placeholder" placeholder="type command... (no-op)" class="bg-transparent outline-none text-sm font-mono text-gray-100 placeholder-gray-500 w-full" />
            </div>
          </div>
      </div>

  <!-- system controls moved to column 2 -->
    </div>

    <!-- Column 2: Visual Controls (Tweakpane) -->
    <div class="bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 overflow-auto min-h-0 md:col-span-3">
      <h3 class="text-white text-sm mb-2">System Controls</h3>
      <div bind:this={systemPaneContainer} class="overflow-auto max-h-[40vh] system-pane mb-4"></div>

      <h3 class="text-white text-sm mb-2">Visual Controls</h3>
      <div bind:this={visualsPaneContainer} class="overflow-auto max-h-[80vh] visuals-pane"></div>
    </div>

  </div>
