import type { SceneDefinition } from '../core/sceneBase';

// Import known visuals here. When you add a new visual, add it to this list.
import sphereScene from './sphereScene';
import chromeVisuals from './chromevisuals';
import marbleVisuals from './marblevisuals';


export const scenes: SceneDefinition[] = [
  sphereScene,
  chromeVisuals,
  marbleVisuals,
 
].filter(Boolean) as SceneDefinition[];

export const sceneMap: Record<string, SceneDefinition> = scenes.reduce((acc, s) => {
  if (s && s.id) acc[s.id] = s;
  return acc;
}, {} as Record<string, SceneDefinition>);

export function getSceneOptions(): Record<string, string> {
  const out: Record<string, string> = {};
  scenes.forEach(s => { if (s && s.id) out[s.label ?? s.id] = s.id; });
  return out;
}

export default scenes;
