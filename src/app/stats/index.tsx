import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarList } from '@/components/bar-list';
import { Card, ListRow, Notice, Section } from '@/components/card';
import { Chips } from '@/components/chips';
import { ColumnChart } from '@/components/column-chart';
import { Icon } from '@/components/icon';
import { LottoBall } from '@/components/lotto-ball';
import { PressableLink } from '@/components/pressable-link';
import { Page } from '@/components/page';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Collapsible } from '@/components/ui/collapsible';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCount, formatKRW } from '@/lib/format';
import { DRAWS_DESC, LATEST_DRAW, type Draw } from '@/lib/lotto/draws';
import {
  carryOverShare,
  consecutiveShare,
  expectedCount,
  expectedPairCount,
  isHigh,
  isOdd,
  lastDigitStats,
  numberStats,
  pickTypeTotals,
  splitDistribution,
  sumDistribution,
  topBy,
  topPairs,
  type NumberStat,
  type ShareStat,
  type SplitRow,
} from '@/lib/lotto/stats';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateMetadata(): Metadata {
  const title = `로또 번호 통계 - 많이 나온 번호, 오래 안 나온 번호 | ${SITE_NAME}`;
  const description = `로또 1~${LATEST_DRAW.round}회 번호별 출현 횟수, 오래 안 나온 번호, 홀짝·고저·합계·끝수 분포, 1등 자동/수동 비율과 역대 기록.`;
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
  { value: '52', label: '최근 1년' },
];

type Tab = 'numbers' | 'patterns' | 'records';
const TABS: { value: Tab; label: string }[] = [
  { value: 'numbers', label: '번호' },
  { value: 'patterns', label: '패턴' },
  { value: 'records', label: '기록' },
];

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function splitRows(rows: SplitRow[], labelFor: (k: number) => string) {
  return rows
    .filter((r) => r.count > 0 || r.theoretical >= 0.005)
    .map((r) => ({ key: String(r.k), label: labelFor(r.k), value: r.share, reference: r.theoretical, valueLabel: pct(r.share) }));
}

function NumberRank({
  title,
  items,
  render,
  half,
}: {
  title: string;
  items: NumberStat[];
  render: (s: NumberStat) => string;
  half?: boolean;
}) {
  return (
    <Card style={half ? styles.half : styles.gap}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.numberList}>
        {items.map((s) => (
          <PressableLink key={s.n} href={`/stats/${s.n}`} style={styles.numberItem}>
            <LottoBall n={s.n} size={34} />
            <ThemedText type="caption" themeColor="textTertiary">
              {render(s)}
            </ThemedText>
          </PressableLink>
        ))}
      </View>
    </Card>
  );
}

function ShareCard({ title, stat, note }: { title: string; stat: ShareStat; note: string }) {
  return (
    <Card style={styles.half}>
      <ThemedText type="caption" themeColor="textTertiary">
        {title}
      </ThemedText>
      <ThemedText style={styles.big}>{pct(stat.share)}</ThemedText>
      <ThemedText type="caption" themeColor="textTertiary">
        이론값 {pct(stat.theoretical)} · {note}
      </ThemedText>
    </Card>
  );
}

function NumbersTab({ draws }: { draws: readonly Draw[] }) {
  const stats = useMemo(() => numberStats(draws), [draws]);
  const expected = expectedCount(draws.length);
  return (
    <>
      <Section title="번호별 출현 횟수" description="보너스 번호 제외">
        <Card>
          <ColumnChart
            columns={stats.map((s) => ({
              key: String(s.n),
              label: String(s.n),
              value: s.count,
              detail: `${s.n}번: ${formatCount(s.count)}회 출현${s.lastRound ? ` · 마지막 ${s.lastRound}회` : ''}`,
            }))}
            reference={{ value: expected, label: `기대값 ${expected.toFixed(1)}회` }}
            tickEvery={5}
          />
        </Card>
      </Section>

      <View style={styles.halves}>
        <NumberRank half title="많이 나온 번호" items={topBy(stats, (s) => s.count, 6)} render={(s) => `${s.count}회`} />
        <NumberRank half title="적게 나온 번호" items={topBy(stats, (s) => s.count, 6, true)} render={(s) => `${s.count}회`} />
      </View>
      <NumberRank
        title="오래 안 나온 번호"
        items={topBy(stats, (s) => s.drawsSince ?? Infinity, 6)}
        render={(s) => (s.drawsSince === null ? '없음' : `${s.drawsSince}회째`)}
      />

      <Section title="번호별 자세히 보기" description="출현 간격, 같이 나온 번호, 사람들이 고르는 정도">
        <Card>
          <View style={styles.ballGrid}>
            {stats.map((s) => (
              <PressableLink key={s.n} href={`/stats/${s.n}`}>
                <LottoBall n={s.n} size={36} />
              </PressableLink>
            ))}
          </View>
        </Card>
      </Section>
    </>
  );
}

function PatternsTab({ draws }: { draws: readonly Draw[] }) {
  const oddEven = useMemo(() => splitRows(splitDistribution(draws, isOdd), (k) => `홀${k} 짝${6 - k}`), [draws]);
  const highLow = useMemo(() => splitRows(splitDistribution(draws, isHigh), (k) => `고${k} 저${6 - k}`), [draws]);
  const sums = useMemo(
    () =>
      sumDistribution(draws).map((r) => ({
        key: r.label,
        label: r.label,
        value: r.share,
        reference: r.theoretical,
        valueLabel: pct(r.share),
      })),
    [draws],
  );
  const digits = useMemo(() => {
    const total = draws.length * 6;
    return lastDigitStats(draws).map((r) => ({
      key: String(r.digit),
      label: `끝수 ${r.digit}`,
      value: r.count / total,
      reference: r.expected / total,
      valueLabel: pct(r.count / total),
    }));
  }, [draws]);
  const consecutive = useMemo(() => consecutiveShare(draws), [draws]);
  const carry = useMemo(() => carryOverShare(draws), [draws]);
  const pairs = useMemo(() => topPairs(draws, 8), [draws]);

  return (
    <>
      <Section title="홀짝 비율">
        <Card>
          <BarList rows={oddEven} referenceLabel="이론값 (무작위일 때)" />
        </Card>
      </Section>
      <Section title="고저 비율" description="저 1~22, 고 23~45">
        <Card>
          <BarList rows={highLow} referenceLabel="이론값 (무작위일 때)" />
        </Card>
      </Section>
      <Section title="번호 합계" description="6개 번호를 더한 값">
        <Card>
          <BarList rows={sums} labelWidth={64} referenceLabel="이론값 (무작위일 때)" />
          <ThemedText type="caption" themeColor="textTertiary">
            가운데(121~160)에 몰리는 건 그 합계를 만드는 조합이 원래 많기 때문이에요.
          </ThemedText>
        </Card>
      </Section>
      <Section title="끝수" description="번호의 일의 자리">
        <Card>
          <BarList rows={digits} labelWidth={52} referenceLabel="이론값 (0, 6~9는 4개씩, 1~5는 5개씩 있어요)" />
        </Card>
      </Section>
      <View style={styles.halves}>
        <ShareCard title="연속 번호가 있는 회차" stat={consecutive} note="12-13처럼" />
        <ShareCard title="지난 회차 번호가 또 나온 회차" stat={carry} note="이월수" />
      </View>
      <Section
        title="같이 많이 나온 번호 쌍"
        description={`기대값 ${expectedPairCount(draws.length).toFixed(1)}회 · 990쌍 중 일부가 많은 건 자연스러워요`}>
        <Card style={styles.pairs}>
          {pairs.map((p, i) => (
            <View key={`${p.a}-${p.b}`} style={styles.pair}>
              <ThemedText type="caption" themeColor="textTertiary" style={styles.pairRank}>
                {i + 1}
              </ThemedText>
              <LottoBall n={p.a} size={30} />
              <LottoBall n={p.b} size={30} />
              <ThemedText type="smallBold" style={styles.pairCount}>
                {p.count}회
              </ThemedText>
            </View>
          ))}
        </Card>
      </Section>
    </>
  );
}

function RecordsTab({ draws }: { draws: readonly Draw[] }) {
  const theme = useTheme();
  const picks = useMemo(() => pickTypeTotals(draws), [draws]);
  const withFirst = draws.filter((d) => d.ranks[0].winners > 0);
  const totalPicks = picks ? picks.auto + picks.manual + picks.semiAuto : 0;
  const lists: { title: string; items: Draw[]; text: (d: Draw) => string }[] = [
    {
      title: '1등이 가장 많이 나온 회차',
      items: topBy(draws, (d) => d.ranks[0].winners, 5),
      text: (d) => `${d.ranks[0].winners}명 · 1인당 ${formatKRW(d.ranks[0].prize)}`,
    },
    {
      title: '1등 당첨금이 가장 컸던 회차',
      items: topBy(withFirst, (d) => d.ranks[0].prize, 5),
      text: (d) => `1인당 ${formatKRW(d.ranks[0].prize)} · ${d.ranks[0].winners}명`,
    },
    {
      title: '1등 당첨금이 가장 작았던 회차',
      items: topBy(withFirst, (d) => d.ranks[0].prize, 3, true),
      text: (d) => `1인당 ${formatKRW(d.ranks[0].prize)} · ${d.ranks[0].winners}명`,
    },
  ];
  return (
    <>
      {picks && (
        <Section title="1등은 자동이 많을까?" description={`${picks.fromRound}회 이후 1등 ${formatCount(totalPicks)}명`}>
          <Card>
            <View style={styles.stack}>
              {[
                { label: '자동', value: picks.auto, color: theme.primary },
                { label: '수동', value: picks.manual, color: theme.warning },
                { label: '반자동', value: picks.semiAuto, color: theme.success },
              ].map((p) => (
                <View key={p.label} style={{ flex: p.value || 0.0001, backgroundColor: p.color }} />
              ))}
            </View>
            <View style={styles.legendRow}>
              {[
                { label: '자동', value: picks.auto, color: theme.primary },
                { label: '수동', value: picks.manual, color: theme.warning },
                { label: '반자동', value: picks.semiAuto, color: theme.success },
              ].map((p) => (
                <View key={p.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: p.color }]} />
                  <ThemedText type="caption" themeColor="textSecondary">
                    {p.label} {formatCount(p.value)}명 ({Math.round((p.value / totalPicks) * 100)}%)
                  </ThemedText>
                </View>
              ))}
            </View>
            <ThemedText type="caption" themeColor="textTertiary">
              어느 방식이든 당첨 확률은 같아요. 수동은 사람들이 비슷한 번호를 골라서 1등이 여러 명 나오는 회차가 생겨요.
            </ThemedText>
          </Card>
        </Section>
      )}
      {lists.map((l) => (
        <Section key={l.title} title={l.title}>
          <Card style={styles.list}>
            {l.items.map((d, i) => (
              <ListRow
                key={d.round}
                href={`/round/${d.round}`}
                last={i === l.items.length - 1}
                left={
                  <ThemedText type="smallBold" style={styles.roundCol}>
                    {d.round}회
                  </ThemedText>
                }
                title={
                  <ThemedText type="small" themeColor="textSecondary">
                    {l.text(d)}
                  </ThemedText>
                }
              />
            ))}
          </Card>
        </Section>
      ))}
      <Notice>{`1등이 없었던 회차는 ${draws.length - withFirst.length}번이에요.`}</Notice>
    </>
  );
}

export default function StatsScreen() {
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>('all');
  const [tab, setTab] = useState<Tab>('numbers');
  const draws = useMemo(() => (period === 'all' ? DRAWS_DESC : DRAWS_DESC.slice(0, Number(period))), [period]);
  const range = `${draws[draws.length - 1].round}~${draws[0].round}회 · ${formatCount(draws.length)}번의 추첨`;

  return (
    <Page title="번호 통계" subtitle={range}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      <Chips options={PERIODS} value={period} onChange={setPeriod} />
      <Notice>추첨은 매번 완전한 무작위라서, 지난 통계가 다음 번호에 영향을 주지 않아요.</Notice>

      {tab === 'numbers' && <NumbersTab draws={draws} />}
      {tab === 'patterns' && <PatternsTab draws={draws} />}
      {tab === 'records' && <RecordsTab draws={draws} />}

      <PressableLink href="/stats/stores">
        <Card style={styles.storeLink}>
          <View style={[styles.storeIcon, { backgroundColor: `${theme.warning}1A` }]}>
            <Icon name="store" size={22} color={theme.warning} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="smallBold">1등 당첨 판매점</ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              1등이 많이 나온 판매점과 지역별 당첨 수
            </ThemedText>
          </View>
          <Icon name="chevronRight" size={16} color={theme.textTertiary} />
        </Card>
      </PressableLink>

      <Collapsible title="표로 보기 (번호별 출현 횟수)">
        <NumberTable draws={draws} />
      </Collapsible>
    </Page>
  );
}

function NumberTable({ draws }: { draws: readonly Draw[] }) {
  const theme = useTheme();
  const stats = useMemo(() => numberStats(draws), [draws]);
  return (
    <Card style={styles.table}>
      {stats.map((s) => (
        <View key={s.n} style={[styles.tableRow, { borderColor: theme.border }]}>
          <ThemedText type="small" style={styles.flex}>
            {s.n}번
          </ThemedText>
          <ThemedText type="small" style={styles.flex}>
            {formatCount(s.count)}회
          </ThemedText>
          <ThemedText type="small" themeColor="textTertiary" style={styles.flex}>
            {s.lastRound ? `${s.drawsSince}회 전` : '-'}
          </ThemedText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  halves: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  half: { flexGrow: 1, flexBasis: 280, gap: 12 },
  gap: { gap: 12 },
  numberList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  numberItem: { alignItems: 'center', gap: 4, minWidth: 40 },
  ballGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  big: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  pairs: { gap: 10 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pairRank: { width: 16, textAlign: 'center' },
  pairCount: { marginLeft: 'auto' },
  stack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  list: { paddingVertical: 4 },
  roundCol: { width: 64 },
  storeLink: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.three },
  storeIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  table: { gap: 0, paddingVertical: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
});
