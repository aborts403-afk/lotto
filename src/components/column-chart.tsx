import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type Column = { key: string; label: string; value: number; detail: string };

type Props = {
  columns: Column[];
  height?: number;
  reference?: { value: number; label: string }; // a horizontal reference line, e.g. the expected value
  tickEvery?: number; // show every Nth x label
};

function niceMax(v: number): number {
  const step = Math.pow(10, Math.floor(Math.log10(v || 1)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
  return 10 * step;
}

// Single-series column chart built from Views (works on web and native).
// Tap (or hover on web) a column to see its detail line above the plot.
export function ColumnChart({ columns, height = 180, reference, tickEvery = 1 }: Props) {
  const theme = useTheme();
  const [active, setActive] = useState<string | null>(null);
  const max = niceMax(Math.max(...columns.map((c) => c.value), reference?.value ?? 0));
  const ticks = [0, max / 2, max];
  const activeCol = columns.find((c) => c.key === active);

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor={activeCol ? 'text' : 'textSecondary'} style={styles.detail}>
        {activeCol ? activeCol.detail : '막대를 누르면 자세히 보여요'}
      </ThemedText>
      <View style={styles.plotRow}>
        <View style={[styles.yAxis, { height }]}>
          {ticks
            .slice()
            .reverse()
            .map((t) => (
              <ThemedText key={t} type="small" themeColor="textSecondary" style={styles.tick}>
                {t.toLocaleString('ko-KR')}
              </ThemedText>
            ))}
        </View>
        <View style={[styles.plot, { height }]}>
          {ticks.map((t) => (
            <View key={t} style={[styles.grid, { bottom: (t / max) * height, backgroundColor: theme.chartGrid }]} />
          ))}
          {reference && (
            <View
              style={[styles.reference, { bottom: (reference.value / max) * height, backgroundColor: theme.textSecondary }]}
            />
          )}
          <View style={styles.bars}>
            {columns.map((c) => {
              const isActive = c.key === active;
              return (
                <Pressable
                  key={c.key}
                  accessibilityRole="button"
                  accessibilityLabel={c.detail}
                  onPress={() => setActive(c.key)}
                  onHoverIn={() => setActive(c.key)}
                  onHoverOut={() => setActive((cur) => (cur === c.key ? null : cur))}
                  style={styles.slot}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(1, (c.value / max) * height),
                        backgroundColor: isActive ? theme.chartSeriesStrong : theme.chartSeries,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.xRow}>
        <View style={styles.yAxisSpacer} />
        <View style={styles.xLabels}>
          {columns.map((c, i) => (
            <ThemedText key={c.key} type="small" themeColor="textSecondary" style={styles.xLabel}>
              {i % tickEvery === 0 || i === columns.length - 1 ? c.label : ''}
            </ThemedText>
          ))}
        </View>
      </View>
      {reference && (
        <View style={styles.legend}>
          <View style={[styles.legendLine, { backgroundColor: theme.textSecondary }]} />
          <ThemedText type="small" themeColor="textSecondary">
            {reference.label}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const Y_AXIS_WIDTH = 32;

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  detail: { minHeight: 20 },
  plotRow: { flexDirection: 'row' },
  yAxis: { width: Y_AXIS_WIDTH, justifyContent: 'space-between', marginTop: -10, marginBottom: -10 },
  tick: { fontSize: 11, lineHeight: 20 },
  plot: { flex: 1, position: 'relative' },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  reference: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.8 },
  bars: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'flex-end' },
  // Each slot is the hit target (full plot height); the bar inside leaves a 2px surface gap.
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  xRow: { flexDirection: 'row' },
  yAxisSpacer: { width: Y_AXIS_WIDTH },
  xLabels: { flex: 1, flexDirection: 'row' },
  xLabel: { flex: 1, textAlign: 'center', fontSize: 10, lineHeight: 14 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 16, height: 1 },
});
