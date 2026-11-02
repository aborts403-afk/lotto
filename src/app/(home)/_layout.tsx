import { Stack } from 'expo-router';

// The home tab: home plus the round pages (/round, /round/:round), which are reached from home.
// A route group keeps their URLs unchanged.
export default function HomeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
