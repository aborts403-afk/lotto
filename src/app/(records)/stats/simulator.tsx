import { router, useLocalSearchParams } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Notice } from '@/components/card';
import { Chips } from '@/components/chips';
import { HERO_BLUE } from '@/components/draw-hero';
import { LottoBall } from '@/components/lotto-ball';
import { NumberEntry } from '@/components/number-entry';
import { SavedNumbersPicker } from '@/components/saved-numbers-picker';
import { Page } from '@/components/page';
import { RecordsTabs } from '@/components/tab-strip';
import { ThemedText } from '@/components/themed-text';
import { RANK_COLORS } from '@/components/ticket-result';
import { Radius, Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useAllDraws } from '@/hooks/use-latest-draw';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import { formatCount, formatKRW } from '@/lib/format';
import { parseNumbers, type Rank } from '@/lib/lotto/check';
import { simulate } from '@/lib/lotto/simulate';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateMetadata(): Metadata {
  const title = `로또 시뮬레이터 - 내 번호로 그때부터 샀다면 | ${SITE_NAME}`;
  const description =
    '내 로또 번호를 1년, 5년, 20년 전부터 매주 샀다면 얼마를 쓰고 얼마를 받았을지, 실제 역대 당첨 결과로 계산해요.';
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/stats/simulator` },
    openGraph: { title, description, url: `${SITE_URL}/stats/simulator`, siteName: SITE_NAME, type: 'website' },
  };
}

type Period = '52' | '260' | '520' | '1040' | 'all';
const PERIODS: { value: Period; label: string; text: string }[] = [
  { value: '52', label: '1년', text: '1년' },
  { value: '260', label: '5년', text: '5년' },
  { value: '520', label: '10년', text: '10년' },
  { value: '1040', label: '20년', text: '20년' },
  { value: 'all', label: '1회부터', text: '1회(2002년)부터' },
];
const RANKS: Rank[] = [1, 2, 3, 4, 5];
const WHITE_SOFT = 'rgba(255,255,255,0.85)';

function percent(rate: number): string {
  const p = Math.round(rate * 100);
  return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`;
}

function Result({ numbers, period, onToast }: { numbers: number[]; period: Period; onToast: (m: string) => void }) {
  const theme = useTheme();
  const draws = useAllDraws();
  const r = useMemo(() => simulate(numbers, draws, period === 'all' ? null : Number(period)), [numbers, draws, period]);
  const periodText = PERIODS.find((p) => p.value === period)!.text;
  const best = r.best;
  const bestText = !best
    ? null
    : best.rank === 1
      ? `${best.round}회에 6개가 모두 맞았어요. 1등이었어요!`
      : best.matched >= 3
        ? `가장 아까웠던 날: ${best.round}회, ${best.matched}개${best.bonus ? ' + 보너스' : ''}가 맞아 ${best.rank}등이었어요.${best.matched === 5 ? ' 하나만 더 맞았으면 1등이었어요.' : ''}`
        : `가장 많이 맞은 날도 ${best.matched}개였어요 (${best.round}회).`;

  const shareText = [
    `${SITE_NAME} 시뮬레이터`,
    `${numbers.join(' ')} 번호로 ${periodText} 매주 1장 샀다면`,
    `쓴 돈 ${formatKRW(r.spent)}, 받은 돈 ${formatKRW(r.won)} (${percent(r.returnRate)})`,
    `${SITE_URL}/stats/simulator?numbers=${numbers.join(',')}`,
  ].join('\n');
  const share = async () => {
    try {
      if (Platform.OS === 'web' && !(typeof navigator !== 'undefined' && typeof navigator.share === 'function'))
        throw new Error('no share');
      await Share.share({ message: shareText });
    } catch {
      try {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(shareText);
        onToast('결과를 복사했어요');
      } catch {
        onToast('공유하지 못했어요');
      }
    }
  };

  return (
    <>
      <View style={styles.hero}>
        <ThemedText type="caption" style={[styles.white, styles.bold, { color: WHITE_SOFT }]}>
          이 번호로 {periodText} 매주 1장 ({formatCount(r.draws)}회)
        </ThemedText>
        <View style={styles.heroBalls}>
          {numbers.map((n) => (
            <LottoBall key={n} n={n} size={34} outline="rgba(255,255,255,0.9)" />
          ))}
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <ThemedText type="caption" style={{ color: WHITE_SOFT }}>
              쓴 돈
            </ThemedText>
            <ThemedText style={[styles.white, styles.statValue]}>{formatKRW(r.spent)}</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText type="caption" style={{ color: WHITE_SOFT }}>
              받은 돈
            </ThemedText>
            <ThemedText style={[styles.white, styles.statValue]}>{formatKRW(r.won)}</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText type="caption" style={{ color: WHITE_SOFT }}>
              수익률
            </ThemedText>
            <ThemedText style={[styles.white, styles.statValue]}>{percent(r.returnRate)}</ThemedText>
          </View>
        </View>
        {bestText && (
          <View style={styles.callout}>
            <ThemedText type="small" style={styles.white}>
              {bestText}
            </ThemedText>
          </View>
        )}
      </View>

      <Card style={styles.list}>
        {RANKS.map((rank, i) => {
          const color = RANK_COLORS[rank];
          return (
            <View
              key={rank}
              style={[styles.rankRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
              <View style={[styles.rankBadge, { backgroundColor: `${color}1A` }]}>
                <ThemedText type="caption" style={{ color, fontWeight: '800' }}>
                  {rank}등
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{formatCount(r.counts[rank])}번</ThemedText>
              <ThemedText type="caption" themeColor="textTertiary" style={styles.rankNote}>
                {rank === 1 && r.firstWins.length ? `${r.firstWins.join(', ')}회` : ''}
              </ThemedText>
            </View>
          );
        })}
      </Card>

      <View style={styles.row}>
        <Button label="결과 공유" icon="share" variant="primary" onPress={share} style={styles.grow} />
        <Button label="번호 진단" variant="tonal" onPress={() => router.push(`/diagnose?numbers=${numbers.join(',')}`)} />
      </View>

      <Notice>
        {`${r.fromRound}~${r.toRound}회 실제 결과로 계산했어요. 받은 돈은 회차별 실제 1인당 당첨금(세전)이고, 87회까지는 한 장에 2,000원이었어요. 지난 결과는 앞으로의 당첨과 관계없어요.`}
      </Notice>
    </>
  );
}

export default function SimulatorScreen() {
  const hydrated = useHydrated();
  const params = useLocalSearchParams<{ numbers?: string }>();
  const [numbers, setNumbers] = useState<number[] | null>(null);
  const [period, setPeriod] = useState<Period>('1040');
  const [toast, setToast] = useToast();
  // The static HTML has no query string, so a prefilled ?numbers= is read only after hydration.
  const current = useMemo(
    () => numbers ?? (hydrated && params.numbers ? parseNumbers(params.numbers) : []),
    [numbers, hydrated, params.numbers],
  );
  const sorted = useMemo(() => [...current].sort((a, b) => a - b), [current]);

  return (
    <Page title="기록" subtitle="시뮬레이션 · 같은 번호를 매주 샀다면 얼마를 받았을까" toast={toast}>
      <RecordsTabs />
      <Card>
        <NumberEntry numbers={current} onChange={setNumbers} onLimit={() => setToast('번호는 6개까지 고를 수 있어요')} />
        {current.length < 6 && hydrated && <SavedNumbersPicker onPick={setNumbers} verb="로 계산하기" />}
      </Card>

      <Chips options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} value={period} onChange={setPeriod} scroll />

      {hydrated && sorted.length === 6 ? (
        <Result numbers={sorted} period={period} onToast={setToast} />
      ) : (
        <Notice>늘 사는 번호를 넣어 보세요. 그 번호로 매주 1장씩 샀다면 얼마를 쓰고 얼마를 받았을지 보여 드려요.</Notice>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  white: { color: '#FFFFFF' },
  bold: { fontWeight: '700' },
  hero: { backgroundColor: HERO_BLUE, borderRadius: Radius.lg + 4, padding: 20, gap: Spacing.three },
  heroBalls: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  callout: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: Radius.md, padding: 12 },
  list: { paddingVertical: 4, gap: 0 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rankBadge: { width: 44, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  rankNote: { marginLeft: 'auto' },
  row: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
  pressed: { opacity: 0.7 },
});
