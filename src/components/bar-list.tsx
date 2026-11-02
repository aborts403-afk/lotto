import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BarRow = {
  key: string;
  label: string;
  value: number; // bar length, relative to the largest value/reference in the list
  valueLabel: string;
  reference?: number; // e.g. theoretical share, drawn as a tick on the track
};

// Horizontal bars with labels and values. A reference tick (theory) lets readers compare at a glance.
export function BarList({
  rows,
  labelWidth = 64,
  referenceLabel,
}: {
  rows: BarRow[];
  labelWidth?: number;
  referenceLabel?: string;
}) {
  const theme = useTheme();
  const max = Math.max(...rows.map((r) => Math.max(r.value, r.reference ?? 0))) || 1;
  const hasRef = rows.some((r) => r.reference !== undefined);
  return (
    <View style={styles.wrap}>
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <ThemedText type="caption" themeColor="textSecondary" style={{ width: labelWidth }} numberOfLines={1}>
            {r.label}
          </ThemedText>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.bar, { width: `${(r.value / max) * 100}%`, backgroundColor: theme.chartSeries }]} />
            {r.reference !== undefined && (
              <View style={[styles.tick, { left: `${(r.reference / max) * 100}%`, backgroundColor: theme.text }]} />
            )}
          </View>
          <ThemedText type="caption" style={styles.value}>
            {r.valueLabel}
          </ThemedText>
        </View>
      ))}
      {hasRef && referenceLabel && (
        <View style={styles.legend}>
          <View style={[styles.legendTick, { backgroundColor: theme.text }]} />
          <ThemedText type="caption" themeColor="textTertiary">
            {referenceLabel}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'visible', justifyContent: 'center' },
  bar: { height: 10, borderRadius: 5, minWidth: 2 },
  tick: { position: 'absolute', width: 2, height: 16, top: -3, marginLeft: -1, borderRadius: 1 },
  value: { width: 52, textAlign: 'right', fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  legendTick: { width: 2, height: 12, borderRadius: 1 },
});
