import { StyleSheet, Text, View } from 'react-native';

// Official ball colors by number range.
function ballColor(n: number): string {
  if (n <= 10) return '#FBC400';
  if (n <= 20) return '#69C8F2';
  if (n <= 30) return '#FF7272';
  if (n <= 40) return '#AAAAAA';
  return '#B0D840';
}

export function LottoBall({ n, size = 36 }: { n: number; size?: number }) {
  return (
    <View
      style={[styles.ball, { width: size, height: size, borderRadius: size / 2, backgroundColor: ballColor(n) }]}
      accessibilityLabel={`${n}번`}>
      <Text style={[styles.text, { fontSize: size * 0.42 }]}>{n}</Text>
    </View>
  );
}

export function LottoBalls({ numbers, size }: { numbers: readonly number[]; size?: number }) {
  return (
    <View style={styles.row}>
      {numbers.map((n) => (
        <LottoBall key={n} n={n} size={size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ball: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 2 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
});
