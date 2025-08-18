<script lang="ts">
import { onMount } from 'svelte';
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, Color3, StandardMaterial } from '@babylonjs/core';

let canvas: HTMLCanvasElement | null = null;
let torus: any;
let engine: any;
let scene: any;

// Mirror mode - no need for mic controls on this window
onMount(() => {
    engine = new Engine(canvas, true);
    scene = new Scene(engine);

    // Camera
    const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2.5, 6, new Vector3(0, 0, 0), scene);
    camera.attachControl(canvas, true);

    // Light
    const light = new HemisphericLight('light', new Vector3(1, 1, 0), scene);

    // Torus - same as main canvas
    torus = MeshBuilder.CreateTorus('torus', { diameter: 2, thickness: 0.2 }, scene);
    
    // Add some material with color
    const material = new StandardMaterial("torusMaterial", scene);
    material.diffuseColor = new Color3(0.8, 0.2, 0.4); // Different color than main canvas
    material.specularColor = new Color3(0.87, 0.5, 0.6);
    material.emissiveColor = new Color3(0.3, 0.1, 0.1);
    torus.material = material;

    // Set the scene background color to black
    scene.clearColor = new Color3(0, 0, 0).toColor4();

    // Setup the sync interval
    let lastUpdateTime = 0;
    
    engine.runRenderLoop(() => {
        // Read state from localStorage (set by main window)
        try {
            const stateStr = localStorage.getItem('vj-state');
            if (stateStr) {
                const state = JSON.parse(stateStr);
                
                // Only process if this is a new update
                if (state.timestamp > lastUpdateTime) {
                    lastUpdateTime = state.timestamp;
                    
                    // Apply the values from the main window
                    if (torus) {
                        const finalDiameter = state.diameterMultiplier;
                        torus.scaling.x = finalDiameter / 2;
                        torus.scaling.y = finalDiameter / 2;
                        torus.scaling.z = finalDiameter / 2;
                    }
                }
            }
        } catch (e) {
            console.error('Error reading from localStorage', e);
        }
        
        // Add some rotation for visual interest regardless of sync
        if (torus) {
            torus.rotation.y += 0.01;        }
        
        scene.render();
    });
    
    // Resize
    window.addEventListener('resize', () => {
        engine.resize();
    });

    return () => {
        engine.dispose();
    };
});
</script>

<div class="bg-black min-h-screen flex items-center justify-center">
  <canvas bind:this={canvas} style="width: 100vw; height: 100vh; display: block; background: #000;"></canvas>
</div>
