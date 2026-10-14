import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export type Sound = 'tap' | 'coin' | 'reveal' | 'legend';
const SOURCES: Record<Sound, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  coin: require('../../assets/sounds/coin.wav'),
  reveal: require('../../assets/sounds/reveal.wav'),
  legend: require('../../assets/sounds/legend.wav'),
};
let enabled = true;
const players: Partial<Record<Sound, AudioPlayer>> = {};

let haptics = true;

export function setSoundOn(on: boolean) { enabled = on; }
export function setHapticsOn(on: boolean) { haptics = on; }

export function play(s: Sound) {
  if (!enabled) return;
  try {
    const p = (players[s] ??= createAudioPlayer(SOURCES[s]));
    p.seekTo(0);
    p.play();
  } catch {
    // ignore audio errors
  }
}

export function buzz(kind: 'light' | 'success' | 'error') {
  if (!haptics) return;
  if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  else Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
}
