import * as Tone from 'tone';

let mic: Tone.UserMedia | null = null;
let meter: any = null; // Tone.Meter has some typing inconsistencies across versions
let micActive = false;

/**
 * Get or create the Meter instance used to read levels.
 */
export function getMeter() {
  if (!meter) {
    meter = new Tone.Meter();
  }
  return meter;
}

/**
 * Start the microphone input and connect to the meter.
 */
export async function startMic(): Promise<void> {
  if (micActive) return;
  await Tone.start();
  mic = new Tone.UserMedia();
  await mic.open();
  mic.connect(getMeter());
  // Ensure mic is NOT connected to Tone.Destination
  if ((mic as any).disconnect) {
    try { (mic as any).disconnect(Tone.Destination); } catch (e) {}
  }
  micActive = true;
}

/**
 * Stop the microphone input and clean up. This is defensive across Tone.js versions.
 */
export async function stopMic(): Promise<void> {
  if (!mic) return;

  try {
    // Prefer dispose when available
    if (typeof (mic as any).dispose === 'function') {
      try { (mic as any).dispose(); } catch (e) { /* ignore */ }
    } else {
      try { await mic.close(); } catch (e) { /* ignore */ }
    }

    // Defensive disconnects
    if ((mic as any).disconnect) {
      try { mic.disconnect(getMeter()); } catch (e) {}
      try { mic.disconnect(Tone.Destination); } catch (e) {}
      try { mic.disconnect(); } catch (e) {}
    }

    // Defensive: stop underlying MediaStream tracks if accessible
    const stream = (mic as any).stream || (mic as any).mediaStream || (mic as any)._mediaStream || (mic as any).mediaStreamTrack;
    if (stream && typeof stream.getTracks === 'function') {
      try {
        stream.getTracks().forEach((t: MediaStreamTrack) => { try { t.stop(); } catch (e) {} });
      } catch (e) { /* ignore */ }
    }
  } catch (err) {
    // ignore but log to console
    // console.error('Error during stopMic cleanup', err);
  } finally {
    mic = null;
    micActive = false;
  }
}

export function isMicActive() {
  return micActive;
}

export function disposeAudio() {
  // best-effort cleanup
  try {
    if (mic) {
      if (typeof (mic as any).dispose === 'function') {
        try { (mic as any).dispose(); } catch (e) {}
      } else {
        try { (mic as any).close?.(); } catch (e) {}
      }
    }
  } catch (e) {}
  mic = null;
  try { if (meter && typeof meter.dispose === 'function') meter.dispose(); } catch (e) {}
  meter = null;
  micActive = false;
}
