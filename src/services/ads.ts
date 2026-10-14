// Web has no ad network: the UI shows a simulated 30-second ad instead.
import type { AdKind } from '../game/rules';
export const adsSimulated = true;
export async function showRewardedAd(_kind: AdKind, _userId?: string): Promise<boolean> {
  return true;
}
