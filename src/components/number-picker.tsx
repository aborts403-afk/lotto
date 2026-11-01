import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LottoBall } from '@/components/lotto-ball';
import { useTheme } from '@/hooks/use-theme';

const NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1);
const SIZE = 36;

// 1..45 grid. Fixed numbers show as colored balls, excluded ones are struck through.
export function NumberPicker({
  fixed,
  excluded,
  onPress,
}: {
  fixed: readonly number[];
  excluded: readonly number[];
  onPress: (n: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {NUMBERS.map((n) => {
        const isFixed = fixed.includes(n);
        const isExcluded = excluded.includes(n);
        const state = isFixed ? '고정' : isExcluded ? '제외' : '선택 안 함';
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n}번, ${state}`}
            onPress={() => onPress(n)}
            style={({ pressed }) => pressed && styles.pressed}>
            {isFixed ? (
              <LottoBall n={n} size={SIZE} />
            ) : (
              <View
                style={[
                  styles.cell,
                  isExcluded
                    ? { backgroundColor: theme.backgroundSelected, borderColor: theme.backgroundSelected }
                    : { borderColor: theme.chartGrid },
                ]}>
                <Text
                  style={[
                    styles.text,
                    { color: theme.textSecondary },
                    isExcluded && styles.excludedText,
                  ]}>
                  {n}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 15, fontWeight: '600' },
  excludedText: { textDecorationLine: 'line-through', opacity: 0.6 },
  pressed: { opacity: 0.6 },
});
