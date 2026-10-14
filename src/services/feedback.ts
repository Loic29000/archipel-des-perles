// Web: tiny synthesized sounds and the vibration API when available.
export type Sound = 'tap' | 'coin' | 'reveal' | 'legend';
const NOTES: Record<Sound, number[]> = { tap: [880], coin: [1318, 1760], reveal: [523, 659, 784], legend: [523, 659, 784, 1046, 1318] };
let enabled = true;
let ctx: AudioContext | null = null;

let haptics = true;

export function setSoundOn(on: boolean) { enabled = on; }
export function setHapticsOn(on: boolean) { haptics = on; }

export function play(s: Sound) {
  if (!enabled) return;
  try {
    ctx = ctx ?? new AudioContext();
    let t = ctx.currentTime;
    for (const f of NOTES[s]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.13);
      t += 0.09;
    }
  } catch {
    // audio unavailable
  }
}

export function buzz(kind: 'light' | 'success' | 'error') {
  if (!haptics) return;
  try {
    navigator.vibrate?.(kind === 'light' ? 10 : kind === 'success' ? [20, 40, 30] : [60, 30, 60]);
  } catch {
    // vibration unavailable
  }
}
