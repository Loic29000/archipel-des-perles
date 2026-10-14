// Web: no local notifications.
export interface Reminder { id: string; at: number; title: string; body: string }
export async function enableNotifications(): Promise<boolean> { return false; }
export async function scheduleReminders(_list: Reminder[]): Promise<void> {}
