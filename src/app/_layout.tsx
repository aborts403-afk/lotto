import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          background: c.background,
          card: c.backgroundElement,
          primary: c.primary,
          text: c.text,
          border: c.border,
        },
      }}>
      <AppTabs />
    </ThemeProvider>
  );
}
