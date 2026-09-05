/**
 * A scan can take long enough to walk away from, so it says when it is done.
 *
 * The notes are synthesised rather than loaded: an audio file would be one
 * more asset to fetch, cache and get 404s for on a renamed Pages path, and
 * two sine tones need none of that.
 */

let ctx: AudioContext | null = null;

// Created on the click that starts the scan, which is what satisfies the
// autoplay policy - a context built without a gesture starts suspended.
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Warm the context up while the page still has the click that asked. */
export function primeChime(): void {
  audio();
}

function tone(at: number, hz: number, seconds: number, gain: number): void {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const vol = c.createGain();
  osc.type = "sine";
  osc.frequency.value = hz;
  // Ramped rather than switched: a gain that jumps to zero clicks.
  vol.gain.setValueAtTime(0, c.currentTime + at);
  vol.gain.linearRampToValueAtTime(gain, c.currentTime + at + 0.015);
  vol.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + seconds);
  osc.connect(vol).connect(c.destination);
  osc.start(c.currentTime + at);
  osc.stop(c.currentTime + at + seconds + 0.02);
}

/**
 * Two notes, so it reads as a chime rather than a beep: rising when rows came
 * back, falling when the scan failed, which is the difference someone across
 * the room needs to hear.
 */
export function playChime(ok: boolean): void {
  try {
    if (ok) {
      tone(0, 880, 0.16, 0.12); // A5
      tone(0.11, 1318.5, 0.28, 0.1); // E6
    } else {
      tone(0, 440, 0.18, 0.1); // A4
      tone(0.12, 329.6, 0.34, 0.09); // E4
    }
  } catch {
    /* no audio device, or a policy that will not budge */
  }
}
