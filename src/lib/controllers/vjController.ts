export type VJEngineLike = {
  setMultiplier?: (n: number) => void;
  dispose?: () => void;
  stream?: MediaStream | null;
};

export function createVJController(opts: { throttleMs?: number } = {}) {
  let engine: VJEngineLike | null = null;
  let stream: MediaStream | null = null;
  let lastSent = 0;
  const throttleMs = opts.throttleMs ?? 33;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function attachEngine(e: VJEngineLike | null) {
    engine = e;
    stream = e?.stream ?? null;
  }

  function getStream() { return stream; }

  function dispose() {
    try { engine?.dispose?.(); } catch (e) {}
    try { if (stream) stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); } catch (e) {}
    engine = null;
    stream = null;
    if (timer) { clearTimeout(timer); timer = null; }
  }

  function setMultiplier(scaled: number) {
    const now = Date.now();
    const sendNow = () => {
      try { if (engine && typeof engine.setMultiplier === 'function') engine.setMultiplier(scaled); } catch (e) {}
      lastSent = Date.now();
      timer = null;
    };

    if (!lastSent || (now - lastSent) >= throttleMs) {
      sendNow();
      return;
    }

    if (timer) clearTimeout(timer);
    timer = setTimeout(sendNow, Math.max(0, throttleMs - (now - lastSent)));
  }

  function isReady() { return !!engine; }

  return { attachEngine, setMultiplier, dispose, getStream, isReady } as const;
}

export default createVJController;
