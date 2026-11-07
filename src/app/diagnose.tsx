import { router, useLocalSearchParams } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Notice, Pill, Section } from '@/components/card';
import { LottoBalls } from '@/components/lotto-ball';
import { NumberEntry } from '@/components/number-entry';
import { SavedNumbersPicker } from '@/components/saved-numbers-picker';
import { Page } from '@/components/page';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useAllDraws, useLatestDraw } from '@/hooks/use-latest-draw';
import { addTickets } from '@/hooks/use-my-tickets';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import { formatKRWShort } from '@/lib/format';
import { parseNumbers } from '@/lib/lotto/check';
import { generate, pastWinningKeys, type Combo } from '@/lib/lotto/generator';
import { diagnose, estimatePayout, type PayoutEstimate } from '@/lib/lotto/payout';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateMetadata(): Metadata {
  const title = `로또 번호 진단 - 1등이 되면 몇 명과 나눌까, 예상 실수령액 | ${SITE_NAME}`;
  const description =
    '내 로또 번호가 얼마나 많이 고르는 조합인지, 1등이 되면 몇 명과 상금을 나눌지, 세후 예상 수령액은 얼마인지 계산해요. 덜 겹치는 대안 번호도 추천해요.';
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/diagnose` },
    openGraph: { title, description, url: `${SITE_URL}/diagnose`, siteName: SITE_NAME, type: 'website' },
  };
}

// Where the combination sits between "picked by few" (left) and "picked by many" (right).
function PopularityGauge({ position }: { position: number }) {
  const theme = useTheme();
  return (
    <View style={styles.gaugeWrap}>
      <View style={styles.gauge}>
        <View style={[styles.gaugePart, { backgroundColor: `${theme.success}33` }]} />
        <View style={[styles.gaugePart, { backgroundColor: `${theme.warning}33` }]} />
        <View style={[styles.gaugePart, { backgroundColor: `${theme.danger}33` }]} />
        <View style={[styles.marker, { left: `${Math.min(98, Math.max(1, position))}%`, backgroundColor: theme.text }]} />
      </View>
      <View style={styles.between}>
        <ThemedText type="caption" themeColor="textTertiary">
          덜 고르는 조합
        </ThemedText>
        <ThemedText type="caption" themeColor="textTertiary">
          많이 고르는 조합
        </ThemedText>
      </View>
    </View>
  );
}

function PayoutTile({ label, estimate, accent }: { label: string; estimate: PayoutEstimate; accent?: boolean }) {
  const theme = useTheme();
  const color = accent ? theme.primary : theme.text;
  return (
    <View style={[styles.tile, { backgroundColor: accent ? theme.primarySoft : theme.backgroundSelected }]}>
      <ThemedText
        type="caption"
        style={{ color: accent ? theme.primary : theme.textTertiary, fontWeight: accent ? '700' : '500' }}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.tileAmount, { color }]}>약 {formatKRWShort(estimate.net)}</ThemedText>
      <ThemedText type="caption" style={{ color: accent ? theme.primary : theme.textTertiary }}>
        평균 {estimate.others.toFixed(1)}명과 나눔
      </ThemedText>
    </View>
  );
}

function Result({ numbers, nextRound, onToast }: { numbers: Combo; nextRound: number; onToast: (m: string) => void }) {
  const theme = useTheme();
  const draws = useAllDraws();
  const [seed, setSeed] = useState(0);
  const d = useMemo(() => diagnose(numbers), [numbers]);
  const mine = useMemo(() => estimatePayout(numbers, draws), [numbers, draws]);

  // A less popular alternative that keeps up to two of the numbers people pick least.
  const alternative = useMemo(() => {
    if (d.verdict === 'unpopular') return null;
    const keep = [...d.quietNumbers].slice(0, 2);
    const candidates = generate({ mode: 'unpopular', count: 3, fixed: keep, pastWinning: pastWinningKeys(draws), previous: draws[0]?.numbers, spread: false }).sets.map((s) => s.numbers);
    const best = candidates
      .map((c) => ({ numbers: c, payout: estimatePayout(c, draws) }))
      .sort((a, b) => b.payout.net - a.payout.net)[0];
    return best && best.payout.net > mine.net ? best : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `seed` asks for another alternative
  }, [d, draws, mine.net, seed]);

  const verdict = {
    popular: { label: `많이 고르는 조합 · 상위 ${Math.max(1, d.lessPopularThan)}%`, color: theme.danger },
    average: { label: '평균 수준의 조합', color: theme.textTertiary },
    unpopular: { label: `덜 고르는 조합 · 하위 ${Math.max(1, d.morePopularThan)}%`, color: theme.success },
  }[d.verdict];
  const diff = mine.net - mine.averageNet;

  const save = async (combo: Combo) => {
    const added = await addTickets(nextRound, [combo], 'manual');
    onToast(added ? `${nextRound}회 번호로 저장했어요` : '이미 저장한 번호예요');
  };

  return (
    <>
      <Card>
        <View style={styles.between}>
          <ThemedText type="heading">진단 결과</ThemedText>
          <Pill label={verdict.label} color={verdict.color} soft />
        </View>
        <PopularityGauge position={d.morePopularThan} />
        {d.reasons.length > 0 && (
          <View style={styles.reasons}>
            {d.reasons.map((r) => (
              <View key={r} style={styles.reason}>
                <View style={[styles.dot, { backgroundColor: verdict.color }]} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {r}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Section title="1등이 되면 받는 돈" description="세금 떼고, 같은 번호를 산 사람과 나눈 뒤의 예상액">
        <Card>
          <View style={styles.tiles}>
            <PayoutTile label="내 번호" estimate={mine} />
            {alternative ? (
              <PayoutTile label="추천 대안" estimate={alternative.payout} accent />
            ) : (
              <View style={[styles.tile, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="caption" themeColor="textTertiary">
                  평균적인 번호
                </ThemedText>
                <ThemedText style={styles.tileAmount}>약 {formatKRWShort(mine.averageNet)}</ThemedText>
                <ThemedText type="caption" themeColor="textTertiary">
                  내 번호가 {diff >= 0 ? `${formatKRWShort(diff)} 더` : `${formatKRWShort(-diff)} 덜`} 받아요
                </ThemedText>
              </View>
            )}
          </View>

          {alternative && (
            <View style={styles.altRow}>
              <LottoBalls numbers={alternative.numbers} size={32} />
              <View style={styles.altActions}>
                <Button label="이걸로 저장" size="sm" variant="primary" onPress={() => save(alternative.numbers)} />
                <Button label="다른 대안" size="sm" variant="ghost" onPress={() => setSeed((s) => s + 1)} />
              </View>
            </View>
          )}
          {!alternative && d.verdict === 'unpopular' && (
            <ThemedText type="small" themeColor="textSecondary">
              이미 남들이 덜 고르는 조합이에요. 그대로 사셔도 좋아요.
            </ThemedText>
          )}
          <Button label="내 번호 그대로 저장" size="sm" variant="tonal" onPress={() => save(numbers)} style={styles.alignStart} />
        </Card>
      </Section>

      <Notice>
        {`최근 ${mine.basis.draws}회(${mine.basis.from}~${mine.basis.to}회)의 판매량과 1등 총액으로 계산한 평균이에요. 실제 금액은 회차마다 달라요. 당첨 확률은 어떤 번호든 똑같아요.`}
      </Notice>
    </>
  );
}

export default function DiagnoseScreen() {
  const hydrated = useHydrated();
  const params = useLocalSearchParams<{ numbers?: string }>();
  const [numbers, setNumbers] = useState<number[] | null>(null);
  const [toast, setToast] = useToast();
  const nextRound = useLatestDraw().round + 1;
  // The static HTML has no query string, so a prefilled ?numbers= is read only after hydration.
  const current = useMemo(
    () => numbers ?? (hydrated && params.numbers ? parseNumbers(params.numbers) : []),
    [numbers, hydrated, params.numbers],
  );
  const sorted = useMemo(() => [...current].sort((a, b) => a - b), [current]);

  return (
    <Page title="번호 진단" subtitle="1등이 되면 몇 명과 나누게 될까요?" toast={toast}>
      <Card>
        <NumberEntry numbers={current} onChange={setNumbers} onLimit={() => setToast('번호는 6개까지 고를 수 있어요')} />
        {current.length < 6 && hydrated && <SavedNumbersPicker onPick={setNumbers} verb="진단하기" />}
      </Card>

      {hydrated && sorted.length === 6 ? (
        <Result numbers={sorted} nextRound={nextRound} onToast={setToast} />
      ) : (
        <Notice>
          늘 사는 번호나 생일 번호를 넣어 보세요. 사람들이 얼마나 고르는 조합인지, 1등이 되면 세후 얼마를 받을지 알려 드려요.
        </Notice>
      )}

      <Button label="번호 새로 뽑기" variant="ghost" onPress={() => router.push('/generate')} />
    </Page>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  alignStart: { alignSelf: 'flex-start' },
  gaugeWrap: { gap: 6 },
  gauge: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'visible' },
  gaugePart: { flex: 1, height: 10 },
  marker: { position: 'absolute', top: -5, width: 4, height: 20, borderRadius: 2, marginLeft: -2 },
  reasons: { gap: 8 },
  reason: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  tile: { flex: 1, borderRadius: Radius.md, padding: 12, gap: 2 },
  tileAmount: { fontSize: 20, lineHeight: 28, fontWeight: '900' },
  altRow: { gap: Spacing.two },
  altActions: { flexDirection: 'row', gap: Spacing.two },
});
