import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

// Scrollable, centered page body that clears the top tab bar (web) and bottom tabs (native).
export function Page({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}>
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { alignItems: 'center', paddingHorizontal: Spacing.four },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.four },
});
