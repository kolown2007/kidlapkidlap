import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';

export interface SphereSceneSetup {
    engine: Engine;
    scene: Scene;
    sphere: Mesh;
    material?: StandardMaterial;
    dispose: () => void;
}

export function createBabylonSphereScene(canvas: HTMLCanvasElement): SphereSceneSetup {
    const engine = new Engine(canvas, true);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    engine.setHardwareScalingLevel(1 / dpr);
    const scene = new Scene(engine);

    const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2.5, 6, new Vector3(0, 0, 0), scene);
    camera.attachControl(canvas, true);

    const light = new HemisphericLight('light', new Vector3(1, 1, 0), scene);

    const sphere = MeshBuilder.CreateSphere('sphere', { diameter: 2, segments: 32 }, scene);
    const mat = new StandardMaterial('sphere-mat', scene);
    mat.diffuseColor = new Color3(1, 1, 1);
    sphere.material = mat;

    const handleResize = () => {
        try { engine.resize(); } catch (e) {}
    };
    window.addEventListener('resize', handleResize);

    const dispose = () => {
        window.removeEventListener('resize', handleResize);
        try { mat.dispose(); } catch (e) {}
        engine.dispose();
    };

    return {
        engine,
        scene,
        sphere,
        material: mat,
        dispose
    };
}

export function startSphereRenderLoop(
    engine: Engine,
    scene: Scene,
    sphere: Mesh,
    getAudioData: () => { volume: number; value: number }
) {
    engine.runRenderLoop(() => {
        const { volume, value } = getAudioData();

        const minDiameter = 0.5;
        const maxDiameter = 5;
        let norm = Math.max(-60, Math.min(0, volume));
        norm = (norm + 60) / 60;
        const audioDiameter = minDiameter + (1 - norm) * (maxDiameter - minDiameter);

        const multiplier = 0.5 + ((value / 9) * 1.5);
        const finalDiameter = audioDiameter * multiplier;

        if (sphere) {
            sphere.scaling.x = finalDiameter / 2;
            sphere.scaling.y = finalDiameter / 2;
            sphere.scaling.z = finalDiameter / 2;
        }

        try {
            localStorage.setItem('vj-state', JSON.stringify({
                diameterMultiplier: finalDiameter,
                volume,
                sliderValue: value,
                timestamp: Date.now()
            }));
        } catch (e) {}

        scene.render();
    });
}

export default createBabylonSphereScene;
