import { Stack } from 'expo-router';

// The 기록 tab: number stats, the simulator, round results and winning stores. A route group, so
// their URLs (/stats, /round, ...) stay as they are. Opening the tab starts on the stats page.
export const unstable_settings = {
  anchor: 'stats',
};

export default function RecordsLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
