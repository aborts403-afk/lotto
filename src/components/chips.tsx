import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Selectable chips. `scroll` lays them out in one horizontally scrolling row (good for long lists on phones).
export function Chips<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  scroll?: boolean;
}) {
  const theme = useTheme();
  const items = options.map((o) => {
    const selected = o.value === value;
    return (
      <Pressable
        key={o.value}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onChange(o.value)}
        style={({ pressed }) => [
          styles.chip,
          selected ? { backgroundColor: theme.text } : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={{ color: selected ? theme.background : theme.textSecondary }}>
          {o.label}
        </ThemedText>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
        {items}
      </ScrollView>
    );
  }
  return <View style={styles.wrap}>{items}</View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  scroll: { marginHorizontal: -4, flexGrow: 0 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'transparent' },
  pressed: { opacity: 0.7 },
});
