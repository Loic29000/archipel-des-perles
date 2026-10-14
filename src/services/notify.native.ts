import * as Notifications from 'expo-notifications';

export interface Reminder { id: string; at: number; title: string; body: string }

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function enableNotifications(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

// Replaces every pending reminder; `at` is a device timestamp in ms.
export async function scheduleReminders(list: Reminder[]): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const r of list) {
      const seconds = Math.round((r.at - now) / 1000);
      if (seconds < 30) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
      });
    }
  } catch {
    // permissions missing or unsupported platform
  }
}
