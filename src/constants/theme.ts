import '@/global.css';

import { Platform } from 'react-native';

// Semantic colors. Page background is a light gray and content sits on white cards (dark: near-black
// page, dark gray cards), so hierarchy comes from surfaces rather than borders.
export const Colors = {
  light: {
    text: '#191F28',
    textSecondary: '#4E5968',
    textTertiary: '#8B95A1',
    background: '#F2F4F6', // page
    backgroundElement: '#FFFFFF', // card
    backgroundSelected: '#F2F4F6', // nested surface inside a card, selected chip
    border: '#E5E8EB',
    primary: '#3182F6',
    primaryPressed: '#1B64DA',
    primarySoft: '#E8F3FF',
    onPrimary: '#FFFFFF',
    success: '#03A65F',
    danger: '#F04452',
    warning: '#E88A00',
    chartSeries: '#3182F6',
    chartSeriesStrong: '#1B64DA',
    chartMuted: '#C9D1DB',
    chartGrid: '#E5E8EB',
  },
  dark: {
    text: '#F2F3F5',
    textSecondary: '#B0B8C1',
    textTertiary: '#7E8792',
    background: '#0F1013',
    backgroundElement: '#1C1D22',
    backgroundSelected: '#2A2C33',
    border: '#2E3038',
    primary: '#4B96FF',
    primaryPressed: '#3182F6',
    primarySoft: '#1B2B45',
    onPrimary: '#FFFFFF',
    success: '#2BC77F',
    danger: '#FF6670',
    warning: '#FFB020',
    chartSeries: '#4B96FF',
    chartSeriesStrong: '#9CC3FF',
    chartMuted: '#3A3D46',
    chartGrid: '#2E3038',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;
