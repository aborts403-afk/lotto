import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LottoBall } from '@/components/lotto-ball';
import { ThemedText } from '@/components/themed-text';

const GAP = 6;

// Six winning numbers + bonus. `fill`: shrink the balls (up to `size`) so all seven fit the width on one line.
// `highlight`: when given, numbers not in it are faded.
export function DrawNumbers({
  numbers,
  bonus,
  size = 36,
  highlight,
  fill,
}: {
  numbers: readonly number[];
  bonus: number;
  size?: number;
  highlight?: readonly number[];
  fill?: boolean;
}) {
  const [width, setWidth] = useState(0);
  // 7 balls + the "+" (about half a ball) and 7 gaps.
  const ball = fill && width ? Math.min(size, Math.floor((width - GAP * 7) / 7.5)) : size;
  const muted = (n: number) => !!highlight && !highlight.includes(n);
  return (
    <View style={styles.row} onLayout={fill ? (e) => setWidth(e.nativeEvent.layout.width) : undefined}>
      {numbers.map((n) => (
        <LottoBall key={n} n={n} size={ball} muted={muted(n)} />
      ))}
      <ThemedText
        type="smallBold"
        themeColor="textTertiary"
        style={{ fontSize: ball * 0.45, width: ball * 0.5, textAlign: 'center' }}>
        +
      </ThemedText>
      <LottoBall n={bonus} size={ball} muted={muted(bonus)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP, flexWrap: 'wrap' },
});
