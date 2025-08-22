import { initTweakpane, initTweakpaneTwo, type TweakCallbacks } from '../ui/tweakpane';

export type TweakpaneDeps = {
  setPreferSecondScreen: (on: boolean) => void;
  onSceneChange?: (sceneId: string) => void;
  startPreview?: () => void;
  toggleProjection?: () => void;
};

export function createTweakpaneController(systemContainer: HTMLElement | null, visualsContainerOrInitial: any, maybeDeps?: any, maybeDeps2?: any) {
  // signature overloads:
  // createTweakpaneController(container, initial, deps)
  // createTweakpaneController(systemContainer, visualsContainer, initial, deps)
  let systemContainerArg: HTMLElement | null = null;
  let visualsContainer: HTMLElement | null = null;
  let initial: any = {};
  let deps: TweakpaneDeps = {} as any;

  if (arguments.length === 3) {
    systemContainerArg = systemContainer;
    visualsContainer = null;
    initial = visualsContainerOrInitial;
    deps = maybeDeps ?? {};
  } else {
    systemContainerArg = systemContainer as unknown as HTMLElement | null;
    visualsContainer = visualsContainerOrInitial as HTMLElement | null;
    initial = maybeDeps ?? {};
    deps = maybeDeps2 ?? {};
  }

  if (!systemContainerArg && !visualsContainer) return { dispose: () => {} };

  const callbacks: TweakCallbacks = {
    onPreferSecondScreen: (on: boolean) => {
      try { deps.setPreferSecondScreen(!!on); } catch (e) {}
    },
    onSceneChange: (id: string) => {
      try { deps.onSceneChange?.(id); } catch (e) {}
    }
  ,
  onStartPreview: () => { try { deps.startPreview?.(); } catch (e) {} },
  onToggleProjection: () => { try { deps.toggleProjection?.(); } catch (e) {} }
  };
  const res = initTweakpaneTwo(systemContainerArg, visualsContainer, initial, callbacks as any);
  const systemPane = (res && (res as any).systemPane) ? (res as any).systemPane : null;
  const visualsPane = (res && (res as any).visualsPane) ? (res as any).visualsPane : null;
  let sceneFolder: any = null;
  const retryCounts = new Map<any, number>();

  function rebuildForScene(sceneDef: any | null, sceneInstance?: any) {
    try { if (sceneFolder) { try { sceneFolder.dispose(); } catch (e) {} sceneFolder = null; } } catch (e) {}
    if (!visualsPane || !sceneDef || !sceneDef.controls || !sceneInstance) {
      try { console.warn('tweakpaneController.rebuildForScene skipped', { hasVisualsPane: !!visualsPane, hasSceneDef: !!sceneDef, controlsLen: sceneDef?.controls?.length ?? 0, hasInstance: !!sceneInstance }); } catch (e) {}
      // If we have a sceneDef but no instance/pane yet, try a few times to recover from a race
      try {
  if (sceneDef && (!visualsPane || !sceneInstance)) {
          const key = sceneDef;
          const prev = retryCounts.get(key) ?? 0;
          if (prev < 5) {
            retryCounts.set(key, prev + 1);
            const delay = 100 * (prev + 1);
            try { console.warn('tweakpaneController.rebuildForScene will retry', { attempt: prev + 1, delay }); } catch (e) {}
            setTimeout(() => {
              try { rebuildForScene(sceneDef, sceneInstance); } catch (e) {}
            }, delay);
          } else {
            try { retryCounts.delete(key); } catch (e) {}
          }
        }
      } catch (e) {}
      return;
    }

    try {
      // prefer visualsPane folder APIs
    sceneFolder = (visualsPane as any)?.addFolder ? (visualsPane as any).addFolder({ title: 'Visual Controls' }) : null;
        try { if (sceneFolder && 'expanded' in sceneFolder) (sceneFolder as any).expanded = true; } catch (e) {}
        const params: any = {};
        for (const c of sceneDef.controls) params[c.key] = c.default ?? null;

        // choose addInput / addBinding from visuals folder if available, else fall back to visualsPane or systemPane
        const folderAddBinding = sceneFolder && (sceneFolder as any).addBinding ? (sceneFolder as any).addBinding.bind(sceneFolder) : undefined;
        const folderAddInput = sceneFolder && (sceneFolder as any).addInput ? (sceneFolder as any).addInput.bind(sceneFolder) : undefined;
        const visualsPaneAddInput = visualsPane && (visualsPane as any).addInput ? (visualsPane as any).addInput.bind(visualsPane) : undefined;
        const systemPaneAddInput = systemPane && (systemPane as any).addInput ? (systemPane as any).addInput.bind(systemPane) : undefined;

    for (const c of sceneDef.controls) {
        let input: any = null;
        try {
      const add = folderAddBinding ?? folderAddInput ?? visualsPaneAddInput ?? systemPaneAddInput;
          if (!add) throw new Error('no addInput available on folder or pane');
          if (c.type === 'range') {
            input = add(params, c.key, { min: c.min, max: c.max, step: c.step ?? 1 });
          } else if (c.type === 'boolean') {
            input = add(params, c.key);
          } else if (c.type === 'select') {
            input = add(params, c.key, { options: c.options });
          } else if (c.type === 'color') {
            input = add(params, c.key, { view: 'color' });
          } else if (c.type === 'number') {
            input = add(params, c.key);
          }
        } catch (e) {
          try { console.warn('tweakpaneController.addInput failed for control', c, e); } catch (e) {}
        }

        try { console.warn('tweakpaneController.addInput result', { key: c.key, inputExists: !!input, hasOn: typeof input?.on === 'function' }); } catch (e) {}

        if (input && typeof input.on === 'function') {
          input.on('change', (ev: any) => {
            try { sceneInstance.applyControl?.(c.key, ev.value); } catch (e) {}
          });
        }
      }
    } catch (e) { try { console.warn('tweakpaneController.rebuildForScene error', e); } catch (e) {} }
  }

  return {
    dispose() {
      try { res?.dispose?.(); } catch (e) {}
    },
  pane: systemPane,
  systemPane,
  visualsPane,
    rebuildForScene
  };
}

export default createTweakpaneController;
