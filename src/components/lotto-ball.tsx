import { StyleSheet, Text, View } from 'react-native';

// Official ball colors by number range.
function ballColor(n: number): string {
  if (n <= 10) return '#FBC400';
  if (n <= 20) return '#69C8F2';
  if (n <= 30) return '#FF7272';
  if (n <= 40) return '#AAAAAA';
  return '#B0D840';
}

// `muted`: drawn faded (e.g. a ticket number that did not match). `ring`: outlined (e.g. matched the bonus).
export function LottoBall({ n, size = 36, muted, ring }: { n: number; size?: number; muted?: boolean; ring?: boolean }) {
  return (
    <View
      style={[
        styles.ball,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: ballColor(n) },
        muted && styles.muted,
        ring && styles.ring,
      ]}
      accessibilityLabel={`${n}번`}>
      <Text style={[styles.text, { fontSize: size * 0.42 }]}>{n}</Text>
    </View>
  );
}

export function LottoBalls({
  numbers,
  size,
  highlight,
  ring,
}: {
  numbers: readonly number[];
  size?: number;
  highlight?: readonly number[]; // when given, numbers not in it are muted
  ring?: readonly number[];
}) {
  return (
    <View style={styles.row}>
      {numbers.map((n) => (
        <LottoBall key={n} n={n} size={size} muted={highlight && !highlight.includes(n) && !ring?.includes(n)} ring={ring?.includes(n)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ball: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 2 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  muted: { opacity: 0.25 },
  ring: { borderWidth: 3, borderColor: '#208AEF' },
});
