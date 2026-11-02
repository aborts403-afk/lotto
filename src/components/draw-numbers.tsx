import { StyleSheet, View } from 'react-native';

import { LottoBall } from '@/components/lotto-ball';
import { ThemedText } from '@/components/themed-text';

// Six winning numbers + bonus.
// `highlight`: when given, numbers not in it are faded.
export function DrawNumbers({
  numbers,
  bonus,
  size = 36,
  highlight,
}: {
  numbers: readonly number[];
  bonus: number;
  size?: number;
  highlight?: readonly number[];
}) {
  const muted = (n: number) => !!highlight && !highlight.includes(n);
  return (
    <View style={styles.row}>
      {numbers.map((n) => (
        <LottoBall key={n} n={n} size={size} muted={muted(n)} />
      ))}
      <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: size * 0.5 }}>
        +
      </ThemedText>
      <LottoBall n={bonus} size={size} muted={muted(bonus)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
