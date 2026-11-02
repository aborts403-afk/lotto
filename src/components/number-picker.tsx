import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LottoBall } from '@/components/lotto-ball';
import { useTheme } from '@/hooks/use-theme';

const NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1);
const COLUMNS = 7; // same layout as the paper slip
const GAP = 8;
const MAX_SIZE = 44;

// 1..45 grid that fills its container width (7 per row). Selected ("fixed") numbers show as colored
// balls, excluded ones are filled gray and struck through.
export function NumberPicker({
  fixed,
  excluded = [],
  onPress,
}: {
  fixed: readonly number[];
  excluded?: readonly number[];
  onPress: (n: number) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const size = width ? Math.min(MAX_SIZE, Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS)) : 38;
  const rowWidth = size * COLUMNS + GAP * (COLUMNS - 1);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.outer}>
      <View style={[styles.grid, { width: rowWidth }]}>
        {NUMBERS.map((n) => {
          const isFixed = fixed.includes(n);
          const isExcluded = excluded.includes(n);
          const state = isFixed ? '선택됨' : isExcluded ? '제외됨' : '선택 안 함';
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n}번, ${state}`}
              accessibilityState={{ selected: isFixed }}
              onPress={() => onPress(n)}
              style={({ pressed }) => pressed && styles.pressed}>
              {isFixed ? (
                <LottoBall n={n} size={size} />
              ) : (
                <View
                  style={[
                    styles.cell,
                    { width: size, height: size, borderRadius: size / 2 },
                    isExcluded ? { backgroundColor: theme.backgroundSelected } : { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <Text
                    style={[
                      styles.text,
                      { color: isExcluded ? theme.textTertiary : theme.textSecondary, fontSize: size * 0.38 },
                      isExcluded && styles.excludedText,
                    ]}>
                    {n}
                  </Text>
                  {isExcluded && <View style={[styles.slash, { width: size * 0.9, backgroundColor: theme.textTertiary }]} />}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' },
  excludedText: { opacity: 0.6 },
  slash: { position: 'absolute', height: 1.5, transform: [{ rotate: '-45deg' }] },
  pressed: { opacity: 0.6 },
});
