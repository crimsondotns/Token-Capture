/**
 * A scan can take long enough to walk away from, so it says when it is done.
 *
 * The notes are synthesised rather than loaded: an audio file would be one
 * more asset to fetch, cache and get 404s for on a renamed Pages path, and a
 * handful of oscillator notes need none of that.
 */

export type ChimeName = "chime" | "bell" | "ping" | "knock" | "arcade";

export const CHIME_NAMES: { id: ChimeName; label: string }[] = [
  { id: "chime", label: "Chime" },
  { id: "bell", label: "Bell" },
  { id: "ping", label: "Ping" },
  { id: "knock", label: "Knock" },
  { id: "arcade", label: "Arcade" },
];

type Note = {
  at: number; // seconds from the start of the sound
  hz: number;
  seconds: number;
  gain: number; // relative to the master volume
  type?: OscillatorType;
};

// Two notes at least, so each reads as a sound rather than a beep. The
// failure version of every voice falls instead of rising: that is the part
// someone across the room hears without looking.
const VOICES: Record<ChimeName, { ok: Note[]; bad: Note[] }> = {
  chime: {
    ok: [
      { at: 0, hz: 880, seconds: 0.18, gain: 1 },
      { at: 0.11, hz: 1318.5, seconds: 0.34, gain: 0.9 },
    ],
    bad: [
      { at: 0, hz: 440, seconds: 0.2, gain: 0.9 },
      { at: 0.12, hz: 329.6, seconds: 0.38, gain: 0.85 },
    ],
  },
  bell: {
    // A struck bell is a fundamental plus a detuned partial ringing on.
    ok: [
      { at: 0, hz: 1046.5, seconds: 0.9, gain: 0.8 },
      { at: 0, hz: 1567.9, seconds: 0.6, gain: 0.35 },
      { at: 0.18, hz: 2093, seconds: 0.5, gain: 0.2 },
    ],
    bad: [
      { at: 0, hz: 523.3, seconds: 0.9, gain: 0.8 },
      { at: 0, hz: 349.2, seconds: 0.7, gain: 0.4 },
    ],
  },
  ping: {
    ok: [{ at: 0, hz: 1760, seconds: 0.22, gain: 1 }],
    bad: [{ at: 0, hz: 587.3, seconds: 0.26, gain: 1 }],
  },
  knock: {
    // Low and short: the one that carries through a room without being a
    // notification anyone else recognises.
    ok: [
      { at: 0, hz: 196, seconds: 0.12, gain: 1, type: "triangle" },
      { at: 0.13, hz: 261.6, seconds: 0.16, gain: 0.9, type: "triangle" },
    ],
    bad: [
      { at: 0, hz: 174.6, seconds: 0.14, gain: 1, type: "triangle" },
      { at: 0.14, hz: 130.8, seconds: 0.2, gain: 0.9, type: "triangle" },
    ],
  },
  arcade: {
    ok: [
      { at: 0, hz: 659.3, seconds: 0.08, gain: 0.9, type: "square" },
      { at: 0.08, hz: 987.8, seconds: 0.08, gain: 0.9, type: "square" },
      { at: 0.16, hz: 1318.5, seconds: 0.18, gain: 0.9, type: "square" },
    ],
    bad: [
      { at: 0, hz: 311.1, seconds: 0.12, gain: 0.9, type: "square" },
      { at: 0.12, hz: 233.1, seconds: 0.22, gain: 0.9, type: "square" },
    ],
  },
};

let ctx: AudioContext | null = null;

// Created on the click that starts the scan, which is what satisfies the
// autoplay policy - a context built without a gesture starts suspended.
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Warm the context up while the page still has the click that asked. */
export function primeChime(): void {
  audio();
}

function play(c: AudioContext, note: Note, master: number): void {
  const osc = c.createOscillator();
  const vol = c.createGain();
  osc.type = note.type ?? "sine";
  osc.frequency.value = note.hz;
  const start = c.currentTime + note.at;
  const peak = Math.max(0.0002, note.gain * master);
  // Ramped rather than switched: a gain that jumps to zero clicks.
  vol.gain.setValueAtTime(0, start);
  vol.gain.linearRampToValueAtTime(peak, start + 0.012);
  vol.gain.exponentialRampToValueAtTime(0.0001, start + note.seconds);
  osc.connect(vol).connect(c.destination);
  osc.start(start);
  osc.stop(start + note.seconds + 0.02);
}

/**
 * `volume` is 0-1 as the slider reports it, squared on the way in: loudness
 * is perceived roughly logarithmically, so a linear slider spends most of
 * its travel in a range that already sounds loud.
 */
export function playChime(
  ok: boolean,
  options: { name?: ChimeName; volume?: number } = {},
): void {
  try {
    const c = audio();
    if (!c) return;
    const level = Math.min(1, Math.max(0, options.volume ?? 1));
    if (level === 0) return;
    const master = 0.85 * level ** 2 + 0.05;
    const voice = VOICES[options.name ?? "chime"] ?? VOICES.chime;
    for (const note of ok ? voice.ok : voice.bad) play(c, note, master);
  } catch {
    /* no audio device, or a policy that will not budge */
  }
}
