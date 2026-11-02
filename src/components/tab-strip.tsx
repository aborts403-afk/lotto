import { router, usePathname, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TabStripItem<T extends string> = { value: T; label: string };

// Underlined sub-tabs under a page title: the one way the app shows sub-pages of a tab.
export function TabStrip<T extends string>({
  items,
  value,
  onChange,
}: {
  items: TabStripItem<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { borderColor: theme.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="tablist">
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(item.value)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
              <ThemedText style={[styles.label, { color: selected ? theme.text : theme.textTertiary }, selected && styles.bold]}>
                {item.label}
              </ThemedText>
              <View style={[styles.underline, { backgroundColor: selected ? theme.text : 'transparent' }]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// The 기록 tab's pages. Labels are the pages' names; switching replaces the page (no back stack).
const RECORDS: { value: string; label: string }[] = [
  { value: '/stats', label: '번호 통계' },
  { value: '/stats/simulator', label: '시뮬레이션' },
  { value: '/round', label: '회차 결과' },
  { value: '/stats/stores', label: '1등 판매점' },
];

export function RecordsTabs() {
  const pathname = usePathname().replace(/\/+$/, '') || '/';
  const current = RECORDS.find((r) => r.value === pathname)?.value ?? '/stats';
  return <TabStrip items={RECORDS} value={current} onChange={(v) => v !== current && router.replace(v as Href)} />;
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: -Spacing.three },
  row: { paddingHorizontal: Spacing.three, gap: 20 },
  tab: { paddingTop: 6, alignItems: 'center' },
  label: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  bold: { fontWeight: '800' },
  underline: { height: 2.5, alignSelf: 'stretch', marginTop: 8, borderRadius: 2 },
  pressed: { opacity: 0.6 },
});
