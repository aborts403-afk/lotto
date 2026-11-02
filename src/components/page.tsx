import { type Href } from 'expo-router';
import { type PropsWithChildren, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableLink } from '@/components/pressable-link';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';

export type PageProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  back?: { href: Href; label: string };
  right?: ReactNode; // shown next to the title
  toast?: string | null; // short status message floating above the tab bar
}>;

// Scrollable, centered screen body with an optional header (back link, title, subtitle).
export function Page({ title, subtitle, back, right, toast, children }: PageProps) {
  const insets = useScreenInsets();
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.inner}>
          {(title || back) && <PageHeader title={title} subtitle={subtitle} back={back} right={right} />}
          {children}
        </View>
      </ScrollView>
      {toast ? (
        <View pointerEvents="none" style={[styles.toastWrap, { bottom: insets.bottom - 16 }]}>
          <View style={[styles.toast, { backgroundColor: theme.text }]} accessibilityLiveRegion="polite">
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {toast}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

export function PageHeader({ title, subtitle, back, right }: Omit<PageProps, 'children'>) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      {back && (
        <PressableLink href={back.href} accessibilityRole="link" hitSlop={8} style={styles.back}>
          <Icon name="chevronLeft" size={18} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {back.label}
          </ThemedText>
        </PressableLink>
      )}
      {title && (
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <ThemedText type="title" accessibilityRole="header">
              {title}
            </ThemedText>
            {subtitle && (
              <ThemedText type="small" themeColor="textTertiary">
                {subtitle}
              </ThemedText>
            )}
          </View>
          {right}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { alignItems: 'center', paddingHorizontal: Spacing.three },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  header: { gap: Spacing.two, marginBottom: Spacing.one, paddingHorizontal: Spacing.one },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginLeft: -4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: Spacing.three },
  toast: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999, maxWidth: 480, opacity: 0.94 },
});
