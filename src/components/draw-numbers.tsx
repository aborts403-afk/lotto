import { StyleSheet, View } from 'react-native';

import { LottoBall } from '@/components/lotto-ball';
import { ThemedText } from '@/components/themed-text';

// Six winning numbers + bonus.
export function DrawNumbers({ numbers, bonus, size = 36 }: { numbers: readonly number[]; bonus: number; size?: number }) {
  return (
    <View style={styles.row}>
      {numbers.map((n) => (
        <LottoBall key={n} n={n} size={size} />
      ))}
      <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: size * 0.5 }}>
        +
      </ThemedText>
      <LottoBall n={bonus} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
