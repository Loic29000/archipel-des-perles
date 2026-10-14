// Web has no ad network: the UI shows a simulated 30-second ad instead, so there is no consent to gather.
import type { AdKind } from '../game/rules';
export const adsSimulated = true;
export async function initAds(_isMinor: boolean): Promise<boolean> {
  return true;
}
export async function adChoicesAvailable(): Promise<boolean> {
  return false;
}
export async function showAdChoices(): Promise<void> {}
export async function showRewardedAd(_kind: AdKind, _userId?: string): Promise<boolean> {
  return true;
}
