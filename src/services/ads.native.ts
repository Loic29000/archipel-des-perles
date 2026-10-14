// Real rewarded ads through Google AdMob. In development builds Google's test ad unit is used.
// For production set EXPO_PUBLIC_ADMOB_REWARDED_ANDROID / _IOS and the app ids in app.json,
// enable server-side verification on the ad unit (supabase/functions/admob-ssv) and set
// app_config.require_ssv = true.
import { Platform } from 'react-native';
import { AdEventType, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import type { AdKind } from '../game/rules';

export const adsSimulated = false;

const unitId = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
      android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
      ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
    }) ?? TestIds.REWARDED;

export function showRewardedAd(kind: AdKind, userId?: string): Promise<boolean> {
  return new Promise(resolve => {
    const ad = RewardedAd.createForAdRequest(unitId, {
      serverSideVerificationOptions: userId ? { userId, customData: kind } : undefined,
    });
    let earned = false;
    const subs = [
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => ad.show().catch(() => finish())),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }),
      ad.addAdEventListener(AdEventType.CLOSED, () => finish()),
      ad.addAdEventListener(AdEventType.ERROR, () => finish()),
    ];
    function finish() {
      subs.forEach(unsub => unsub());
      resolve(earned);
    }
    ad.load();
  });
}
