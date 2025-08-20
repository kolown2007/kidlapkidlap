import type { SceneSetup } from '$lib/babylonScene';
import { Color4 } from '@babylonjs/core';

export function createSceneController() {
  let setup: SceneSetup | null = null;
  let pendingMultiplier: number | null = null;
  let pendingWireframe: boolean | null = null;
  let pendingBg: string | null = null;

  function applyPending() {
    try {
      if (!setup) return;
      const mesh = (setup as any).torus ?? (setup as any).sphere ?? null;
      if (pendingMultiplier != null && mesh) {
        try {
          mesh.scaling.x = pendingMultiplier;
          mesh.scaling.y = pendingMultiplier;
          mesh.scaling.z = pendingMultiplier;
        } catch (e) {}
        pendingMultiplier = null;
      }
      if (pendingWireframe != null && setup.material) {
        try { setup.material.wireframe = !!pendingWireframe; } catch (e) {}
        pendingWireframe = null;
      }
      if (pendingBg != null && setup.scene) {
        try { (setup.scene as any).clearColor = Color4.FromHexString ? Color4.FromHexString(pendingBg) : new Color4(0,0,0,1); } catch (e) {}
        pendingBg = null;
      }
    } catch (e) {}
  }

  function setSceneSetup(s: SceneSetup | null) {
    setup = s;
    applyPending();
  }

  function getSceneSetup() { return setup; }

  function setMultiplier(mult: number) {
    try {
      const mesh = (setup as any)?.torus ?? (setup as any)?.sphere ?? null;
      if (setup && mesh) {
        try {
          mesh.scaling.x = mult;
          mesh.scaling.y = mult;
          mesh.scaling.z = mult;
        } catch (e) {
          pendingMultiplier = mult;
        }
      } else {
        pendingMultiplier = mult;
      }
    } catch (e) {
      pendingMultiplier = mult;
    }
  }

  function setWireframe(on: boolean) {
    try {
      if (setup && setup.material) {
        try { setup.material.wireframe = !!on; } catch (e) { pendingWireframe = !!on; }
      } else {
        pendingWireframe = !!on;
      }
    } catch (e) {
      pendingWireframe = !!on;
    }
  }

  function setBackgroundColor(hex: string) {
    try {
      if (setup && setup.scene) {
        try { (setup.scene as any).clearColor = Color4.FromHexString ? Color4.FromHexString(hex) : new Color4(0,0,0,1); } catch (e) { pendingBg = hex; }
      } else {
        pendingBg = hex;
      }
    } catch (e) { pendingBg = hex; }
  }

  function dispose() {
    try {
      try { if (setup && typeof (setup as any).dispose === 'function') (setup as any).dispose(); } catch (e) {}
    } finally {
      setup = null;
      pendingMultiplier = null;
      pendingWireframe = null;
      pendingBg = null;
    }
  }

  return { setSceneSetup, getSceneSetup, setMultiplier, setWireframe, setBackgroundColor, dispose } as const;
}

export default createSceneController;
