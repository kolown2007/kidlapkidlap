// Barrel file for library-level imports. Re-export commonly used controllers, core types, audio helpers, and visuals.

// Controllers
export { default as createPreviewController } from './controllers/previewController';
export { default as createProjectionController } from './controllers/projectionController';
export { default as createSceneController } from './controllers/sceneController';
export { default as createTweakpaneController } from './controllers/tweakpaneController';
export { default as createVJController } from './controllers/vjController';

// Projection utility (raw)
export * from './controllers/projection';

// Core
export * from './core/sceneBase';

// Audio
export * from './audio/index';

// Visual scenes
export { default as TorusSceneDef } from './visuals/torusScene';
export { default as SphereSceneDef } from './visuals/sphereScene';
export { default as CubeSceneDef } from './visuals/cubeScene';

// UI
export * from './ui/tweakpane';
