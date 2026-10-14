// Real rewarded ads through Google AdMob. In development builds Google's test ad unit is used.
// For production set EXPO_PUBLIC_ADMOB_REWARDED_ANDROID / _IOS and the app ids in app.json,
// enable server-side verification on the ad unit (supabase/functions/admob-ssv) and set
// app_config.require_ssv = true.
//
// Consent: before the first ad, Google's User Messaging Platform (UMP) shows the GDPR consent
// message configured in AdMob > Privacy & messaging (IAB TCF v2.2), and on iOS the App Tracking
// Transparency explainer. Players under 15 never see that form: their requests are tagged
// under age of consent, non-personalized and rated G.
import { Platform } from 'react-native';
import mobileAds, {
  AdEventType, AdsConsent, AdsConsentPrivacyOptionsRequirementStatus, MaxAdContentRating, RewardedAd, RewardedAdEventType, TestIds,
} from 'react-native-google-mobile-ads';
import type { AdKind } from '../game/rules';

export const adsSimulated = false;

const unitId = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
      android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
      ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
    }) ?? TestIds.REWARDED;

let minor = true;
let started: Promise<boolean> | null = null;

/** Gathers ad consent (adults only) and starts the ad SDK. Safe to call more than once. */
export function initAds(isMinor: boolean): Promise<boolean> {
  minor = isMinor;
  started ??= (async () => {
    try {
      await mobileAds().setRequestConfiguration({
        tagForUnderAgeOfConsent: isMinor,
        tagForChildDirectedTreatment: isMinor,
        maxAdContentRating: isMinor ? MaxAdContentRating.G : MaxAdContentRating.PG,
      });
      const info = isMinor
        ? await AdsConsent.requestInfoUpdate({ tagForUnderAgeOfConsent: true })
        : await AdsConsent.gatherConsent();
      if (!info.canRequestAds) return false;
      await mobileAds().initialize();
      return true;
    } catch {
      return false;
    }
  })();
  return started;
}

/** True when the player can reopen the consent form (GDPR countries, adults). */
export async function adChoicesAvailable(): Promise<boolean> {
  if (minor) return false;
  try {
    const info = await AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    return false;
  }
}

export async function showAdChoices(): Promise<void> {
  await AdsConsent.showPrivacyOptionsForm();
}

export async function showRewardedAd(kind: AdKind, userId?: string): Promise<boolean> {
  if (!(await (started ?? initAds(minor)))) return false;
  return new Promise(resolve => {
    const ad = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: minor,
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
