// Mobile: hands the JSON to the system share sheet (mail, notes, files…).
import { Share } from 'react-native';
export async function saveJsonFile(name: string, data: unknown): Promise<void> {
  await Share.share({ title: name, message: JSON.stringify(data, null, 2) });
}
