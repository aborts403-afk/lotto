import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.wrap}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(o.value)} style={styles.item}>
            <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={styles.inner}>
              <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'text' : 'textSecondary'}>
                {o.label}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 4, borderRadius: Spacing.three, gap: 4 },
  item: { flex: 1 },
  inner: { alignItems: 'center', paddingVertical: 6, borderRadius: Spacing.two },
});

