import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder } from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';

export interface SceneSetup {
    engine: Engine;
    scene: Scene;
    torus: Mesh;
    dispose: () => void;
}

export function createBabylonScene(canvas: HTMLCanvasElement): SceneSetup {
    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);

    // Camera
    const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2.5, 6, new Vector3(0, 0, 0), scene);
    camera.attachControl(canvas, true);

    // Light
    const light = new HemisphericLight('light', new Vector3(1, 1, 0), scene);

    // Torus
    const torus = MeshBuilder.CreateTorus('torus', { diameter: 2, thickness: 0.2 }, scene);

    // Resize handler
    const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        engine.resize();
    };
    
    window.addEventListener('resize', handleResize);

    // Cleanup function
    const dispose = () => {
        window.removeEventListener('resize', handleResize);
        engine.dispose();
    };

    return {
        engine,
        scene,
        torus,
        dispose
    };
}

export function startRenderLoop(
    engine: Engine, 
    scene: Scene, 
    torus: Mesh, 
    getAudioData: () => { volume: number; value: number }
) {
    engine.runRenderLoop(() => {
        const { volume, value } = getAudioData();
        
        // Map volume to diameter (min 0.5, max 5)
        const minDiameter = 0.5;
        const maxDiameter = 5;
        let norm = Math.max(-60, Math.min(0, volume));
        norm = (norm + 60) / 60; // 0 (loud) to 1 (silent)
        const audioDiameter = minDiameter + (1 - norm) * (maxDiameter - minDiameter);
        
        // Use the value from the slider directly for simplicity
        const multiplier = 0.5 + ((value / 9) * 1.5); // Map slider value 0-9 to multiplier 0.5-2
        const finalDiameter = audioDiameter * multiplier;
        
        if (torus) {
            torus.scaling.x = finalDiameter / 2;
            torus.scaling.y = finalDiameter / 2;
            torus.scaling.z = finalDiameter / 2;
        }

        // Share the current state with the second window
        try {
            localStorage.setItem('vj-state', JSON.stringify({
                diameterMultiplier: finalDiameter,
                volume: volume,
                sliderValue: value,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('Could not save state to localStorage', e);
        }
        
        scene.render();
    });
}
