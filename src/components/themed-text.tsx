import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default' // body, 16
    | 'title' // page title, 26
    | 'subtitle' // alias of title (kept for older screens)
    | 'heading' // section heading, 18
    | 'small' // 14
    | 'smallBold'
    | 'caption' // 12
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = type === 'linkPrimary' && !themeColor ? theme.primary : theme[themeColor ?? 'text'];
  return <Text style={[styles.base, { color }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: { fontFamily: Platform.OS === 'web' ? Fonts?.sans : undefined },
  default: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 26, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  link: { fontSize: 14, lineHeight: 20 },
  linkPrimary: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  code: { fontFamily: Fonts?.mono, fontWeight: Platform.select({ android: '700' }) ?? '500', fontSize: 12 },
});
