import { Link } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ColumnChart } from '@/components/column-chart';
import { LottoBall } from '@/components/lotto-ball';
import { Page } from '@/components/page';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Collapsible } from '@/components/ui/collapsible';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCount, formatKRW } from '@/lib/format';
import { DRAWS_DESC, LATEST_DRAW, type Draw } from '@/lib/lotto/draws';
import {
  carryOverShare,
  consecutiveShare,
  expectedCount,
  expectedPairCount,
  isHigh,
  lastDigitStats,
  sumDistribution,
  topPairs,
  isOdd,
  numberStats,
  pickTypeTotals,
  splitDistribution,
  topBy,
  type NumberStat,
  type ShareStat,
  type SplitRow,
} from '@/lib/lotto/stats';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateMetadata(): Metadata {
  const title = `로또 번호 통계 - 많이 나온 번호, 오래 안 나온 번호 | ${SITE_NAME}`;
  const description = `로또 1~${LATEST_DRAW.round}회 번호별 출현 횟수, 오래 안 나온 번호, 홀짝·고저 비율, 1등 자동/수동 비율과 역대 기록.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/stats` },
    openGraph: { title, description, url: `${SITE_URL}/stats`, siteName: SITE_NAME, type: 'website' },
  };
}

type Period = 'all' | '100' | '52';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: '100', label: '최근 100회' },
  { value: '52', label: '최근 52회' },
];

function NumberList({ items, render }: { items: NumberStat[]; render: (s: NumberStat) => string }) {
  return (
    <View style={styles.numberList}>
      {items.map((s) => (
        <View key={s.n} style={styles.numberItem}>
          <LottoBall n={s.n} size={32} />
          <ThemedText type="small" themeColor="textSecondary">{render(s)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function SplitBars({ rows, labelFor }: { rows: SplitRow[]; labelFor: (k: number) => string }) {
  const theme = useTheme();
  const max = Math.max(...rows.map((r) => Math.max(r.share, r.theoretical)));
  return (
    <View style={styles.split}>
      {rows.map((r) => (
        <View key={r.k} style={styles.splitRow}>
          <ThemedText type="small" style={styles.splitLabel}>{labelFor(r.k)}</ThemedText>
          <View style={styles.splitTrack}>
            <View style={[styles.splitBar, { width: `${(r.share / max) * 100}%`, backgroundColor: theme.chartSeries }]} />
          </View>
          <ThemedText type="small" style={styles.splitValue}>{(r.share * 100).toFixed(1)}%</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.splitValue}>{(r.theoretical * 100).toFixed(1)}%</ThemedText>
        </View>
      ))}
      <View style={styles.splitRow}>
        <View style={styles.splitLabel} />
        <View style={styles.splitTrack} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.splitValue}>실제</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.splitValue}>이론</ThemedText>
      </View>
    </View>
  );
}

function ShareLine({ title, stat, note }: { title: string; stat: ShareStat; note: string }) {
  return (
    <Card style={styles.col}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText style={styles.bigNumber}>{(stat.share * 100).toFixed(1)}%</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatCount(stat.count)}/{formatCount(stat.total)}회 · 이론값 {(stat.theoretical * 100).toFixed(1)}%
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText>
    </Card>
  );
}

function RoundLink({ d, text }: { d: Draw; text: string }) {
  return (
    <Link href={`/round/${d.round}`}>
      <ThemedText type="small">
        <ThemedText type="smallBold" style={{ color: '#3c87f7' }}>{d.round}회</ThemedText> {text}
      </ThemedText>
    </Link>
  );
}

export default function StatsScreen() {
  const [period, setPeriod] = useState<Period>('all');
  const draws = useMemo(() => (period === 'all' ? DRAWS_DESC : DRAWS_DESC.slice(0, Number(period))), [period]);
  const stats = useMemo(() => numberStats(draws), [draws]);
  const expected = expectedCount(draws.length);
  const oddEven = useMemo(() => splitDistribution(draws, isOdd), [draws]);
  const highLow = useMemo(() => splitDistribution(draws, isHigh), [draws]);
  const picks = useMemo(() => pickTypeTotals(draws), [draws]);
  const sums = useMemo(
    () => sumDistribution(draws).map((r, i): SplitRow & { label: string } => ({ k: i, count: r.count, share: r.share, theoretical: r.theoretical, label: r.label })),
    [draws],
  );
  const digits = useMemo(() => {
    const total = draws.length * 6;
    return lastDigitStats(draws).map((r): SplitRow => ({ k: r.digit, count: r.count, share: r.count / total, theoretical: r.expected / total }));
  }, [draws]);
  const consecutive = useMemo(() => consecutiveShare(draws), [draws]);
  const carry = useMemo(() => carryOverShare(draws), [draws]);
  const pairs = useMemo(() => topPairs(draws, 8), [draws]);
  const withFirst = draws.filter((d) => d.ranks[0].winners > 0);
  const range = `${draws[draws.length - 1].round}~${draws[0].round}회`;

  return (
    <Page>
      <View style={styles.header}>
        <ThemedText type="subtitle">번호 통계</ThemedText>
        <ThemedText themeColor="textSecondary">재미로 보는 역대 당첨번호 통계</ThemedText>
      </View>

      <Card>
        <ThemedText type="small">
          추첨은 매번 완전한 무작위라서, 지난 통계가 다음 번호에 영향을 주지는 않아요. 많이 나온 번호도 다음 회차에
          나올 확률은 다른 번호와 똑같아요.
        </ThemedText>
      </Card>

      <Segmented options={PERIODS} value={period} onChange={setPeriod} />

      <View style={styles.section}>
        <ThemedText type="smallBold">번호별 출현 횟수 ({range}, 보너스 제외)</ThemedText>
        <ColumnChart
          columns={stats.map((s) => ({
            key: String(s.n),
            label: String(s.n),
            value: s.count,
            detail: `${s.n}번: ${formatCount(s.count)}회 출현${s.lastRound ? ` · 마지막 ${s.lastRound}회` : ''}`,
          }))}
          reference={{ value: expected, label: `모든 번호의 기대값 ${expected.toFixed(1)}회` }}
          tickEvery={5}
        />
        <Collapsible title="표로 보기">
          <View style={styles.table}>
            {stats.map((s) => (
              <View key={s.n} style={styles.tableRow}>
                <ThemedText type="small" style={styles.tableCell}>{s.n}번</ThemedText>
                <ThemedText type="small" style={styles.tableCell}>{formatCount(s.count)}회</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.tableCell}>
                  {s.lastRound ? `${s.drawsSince}회 전` : '-'}
                </ThemedText>
              </View>
            ))}
          </View>
        </Collapsible>
      </View>

      <Card>
        <ThemedText type="smallBold">번호별 자세히 보기</ThemedText>
        <View style={styles.ballGrid}>
          {stats.map((s) => (
            <Link key={s.n} href={`/stats/${s.n}`} asChild>
              <Pressable style={({ pressed }) => pressed && styles.pressed} accessibilityLabel={`${s.n}번 통계`}>
                <LottoBall n={s.n} size={32} />
              </Pressable>
            </Link>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          번호를 누르면 출현 간격, 같이 많이 나온 번호, 사람들이 고르는 정도를 볼 수 있어요.
        </ThemedText>
      </Card>

      <View style={styles.twoCol}>
        <Card style={styles.col}>
          <ThemedText type="smallBold">많이 나온 번호</ThemedText>
          <NumberList items={topBy(stats, (s) => s.count, 6)} render={(s) => `${s.count}회`} />
        </Card>
        <Card style={styles.col}>
          <ThemedText type="smallBold">적게 나온 번호</ThemedText>
          <NumberList items={topBy(stats, (s) => s.count, 6, true)} render={(s) => `${s.count}회`} />
        </Card>
      </View>

      <Card>
        <ThemedText type="smallBold">오래 안 나온 번호</ThemedText>
        <NumberList
          items={topBy(stats, (s) => s.drawsSince ?? Infinity, 6)}
          render={(s) => (s.drawsSince === null ? '기간 내 없음' : `${s.drawsSince}회째`)}
        />
      </Card>

      <View style={styles.section}>
        <ThemedText type="smallBold">홀짝 비율</ThemedText>
        <SplitBars rows={oddEven} labelFor={(k) => `홀${k}:짝${6 - k}`} />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">고저 비율 (저 1~22, 고 23~45)</ThemedText>
        <SplitBars rows={highLow} labelFor={(k) => `고${k}:저${6 - k}`} />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">번호 합계</ThemedText>
        <SplitBars rows={sums} labelFor={(k) => sums[k].label} />
        <ThemedText type="small" themeColor="textSecondary">
          6개 번호를 더한 값이에요. 가운데(121~160)에 몰리는 건 그 합계를 만드는 조합이 원래 많기 때문이에요.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">끝수 (번호의 일의 자리)</ThemedText>
        <SplitBars rows={digits} labelFor={(k) => `${k}`} />
        <ThemedText type="small" themeColor="textSecondary">
          0, 6~9로 끝나는 번호는 4개씩, 1~5로 끝나는 번호는 5개씩 있어서 이론값이 달라요.
        </ThemedText>
      </View>

      <View style={styles.twoCol}>
        <ShareLine title="연속 번호가 있는 회차" stat={consecutive} note="12-13처럼 이어진 번호가 한 쌍 이상" />
        <ShareLine title="지난 회차 번호가 또 나온 회차" stat={carry} note="바로 전 회차 번호가 하나 이상 (이월수)" />
      </View>

      <Card>
        <ThemedText type="smallBold">같이 많이 나온 번호 쌍</ThemedText>
        <View style={styles.pairs}>
          {pairs.map((p) => (
            <View key={`${p.a}-${p.b}`} style={styles.pair}>
              <LottoBall n={p.a} size={28} />
              <LottoBall n={p.b} size={28} />
              <ThemedText type="small" themeColor="textSecondary">{p.count}회</ThemedText>
            </View>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          두 번호가 같이 나오는 횟수의 기대값은 {expectedPairCount(draws.length).toFixed(1)}회예요. 쌍이 990가지나 되니
          그중 몇 쌍이 기대값보다 많이 나오는 건 자연스러운 일이에요.
        </ThemedText>
      </Card>

      <Link href="/stats/stores" asChild>
        <Pressable style={({ pressed }) => pressed && styles.pressed}>
          <Card>
            <ThemedText type="smallBold">1등 당첨 판매점 →</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">1등이 많이 나온 판매점과 지역별 당첨 수</ThemedText>
          </Card>
        </Pressable>
      </Link>

      {picks && (
        <Card>
          <ThemedText type="smallBold">1등은 자동이 많을까, 수동이 많을까?</ThemedText>
          <ThemedText type="small">
            {picks.fromRound}회 이후 1등 {formatCount(picks.auto + picks.manual + picks.semiAuto)}명 중 자동{' '}
            {formatCount(picks.auto)}명, 수동 {formatCount(picks.manual)}명, 반자동 {formatCount(picks.semiAuto)}명이에요.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            어느 방식이든 당첨 확률은 같아요. 자동은 번호가 무작위로 흩어지지만, 수동은 사람들이 비슷한 번호를 고르는
            경향이 있어서 1등이 여러 명 나와 상금을 나누는 회차가 생겨요.
          </ThemedText>
        </Card>
      )}

      <Card>
        <ThemedText type="smallBold">역대 기록 ({range})</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">1등이 가장 많이 나온 회차</ThemedText>
        {topBy(draws, (d) => d.ranks[0].winners, 5).map((d) => (
          <RoundLink key={d.round} d={d} text={`1등 ${d.ranks[0].winners}명 · 1인당 ${formatKRW(d.ranks[0].prize)}`} />
        ))}
        <ThemedText type="small" themeColor="textSecondary" style={styles.recordGap}>1등 당첨금이 가장 컸던 회차</ThemedText>
        {topBy(withFirst, (d) => d.ranks[0].prize, 5).map((d) => (
          <RoundLink key={d.round} d={d} text={`1인당 ${formatKRW(d.ranks[0].prize)} · ${d.ranks[0].winners}명`} />
        ))}
        <ThemedText type="small" themeColor="textSecondary" style={styles.recordGap}>1등 당첨금이 가장 작았던 회차</ThemedText>
        {topBy(withFirst, (d) => d.ranks[0].prize, 3, true).map((d) => (
          <RoundLink key={d.round} d={d} text={`1인당 ${formatKRW(d.ranks[0].prize)} · ${d.ranks[0].winners}명`} />
        ))}
        <ThemedText type="small" themeColor="textSecondary" style={styles.recordGap}>
          1등이 없었던 회차: {draws.length - withFirst.length}번
        </ThemedText>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  section: { gap: Spacing.two },
  numberList: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.two, rowGap: Spacing.three },
  numberItem: { alignItems: 'center', gap: 2, minWidth: 38 },
  twoCol: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  col: { flexGrow: 1, flexBasis: 280 },
  split: { gap: 6 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  splitLabel: { width: 72 },
  splitTrack: { flex: 1, height: 12, justifyContent: 'center' },
  splitBar: { height: 12, borderTopRightRadius: 4, borderBottomRightRadius: 4, minWidth: 1 },
  splitValue: { width: 48, textAlign: 'right' },
  table: { gap: 2 },
  tableRow: { flexDirection: 'row' },
  tableCell: { flex: 1 },
  recordGap: { marginTop: Spacing.two },
  ballGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pressed: { opacity: 0.7 },
  bigNumber: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  pairs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.four, rowGap: Spacing.two },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
