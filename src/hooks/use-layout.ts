import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useHydrated } from './use-hydrated';

export const WIDE_WEB = 768;

/**
 * Web only: true on desktop-width windows (top navigation bar), false on phone-width ones (bottom tab
 * bar, like the app). The static HTML has no window size, so it is laid out for phones until hydrated.
 */
export function useWideWeb(): boolean {
  const hydrated = useHydrated();
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && hydrated && width >= WIDE_WEB;
}

export const WEB_BOTTOM_BAR = 64;
export const WEB_TOP_BAR = 72;

/** Padding a scrolling screen needs so content clears the status bar and the tab bar. */
export function useScreenInsets(): { top: number; bottom: number } {
  const insets = useSafeAreaInsets();
  const wide = useWideWeb();
  if (Platform.OS !== 'web') return { top: insets.top + 12, bottom: insets.bottom + BottomTabInset + 32 };
  if (wide) return { top: WEB_TOP_BAR + 24, bottom: 48 };
  return { top: insets.top + 16, bottom: insets.bottom + WEB_BOTTOM_BAR + 32 };
}
