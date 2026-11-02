import { router, useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Pill, Section } from '@/components/card';
import { DrawNumbers } from '@/components/draw-numbers';
import { Icon } from '@/components/icon';
import { PressableLink } from '@/components/pressable-link';
import { Page } from '@/components/page';
import { RoundStores } from '@/components/round-stores';
import { ThemedText } from '@/components/themed-text';
import { RANK_COLORS } from '@/components/ticket-result';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCount, formatDateDots, formatDateKo, formatKRW } from '@/lib/format';
import { DRAWS_DESC, firstPrizeSharing, getDraw, LATEST_DRAW, type Draw } from '@/lib/lotto/draws';
import { lessPopularThanPercent } from '@/lib/lotto/generator';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export async function generateStaticParams(): Promise<Record<string, string>[]> {
  return DRAWS_DESC.map((d) => ({ round: String(d.round) }));
}

export const generateMetadata: GenerateMetadataFunction = (_request, params) => {
  const d = getDraw(Number(params.round));
  if (!d) return { title: `회차를 찾을 수 없어요 | ${SITE_NAME}` };
  const title = `로또 ${d.round}회 당첨번호 (${formatDateDots(d.drawDate)}) | ${SITE_NAME}`;
  const first = d.ranks[0];
  const description =
    `로또 ${d.round}회(${formatDateKo(d.drawDate)}) 당첨번호 ${d.numbers.join(', ')} 보너스 ${d.bonus}. ` +
    (first.winners > 0 ? `1등 ${first.winners}명, 1인당 ${formatKRW(first.prize)}.` : '1등 당첨자 없음.');
  const url = `${SITE_URL}/round/${d.round}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, type: 'article' },
  };
};

const RANK_RULES = ['6개 번호 일치', '5개 + 보너스 번호', '5개 번호 일치', '4개 번호 일치', '3개 번호 일치'];

function SharingCard({ d }: { d: Draw }) {
  const theme = useTheme();
  const s = firstPrizeSharing(d);
  const pct = lessPopularThanPercent(d.numbers);
  const verdict = {
    popular: { label: '많이 고른 조합', color: theme.danger },
    average: { label: '평균 수준', color: theme.textTertiary },
    unpopular: { label: '적게 고른 조합', color: theme.success },
  }[s.verdict];
  return (
    <Section title="이 번호는 인기 조합이었을까?">
      <Card>
        <View style={styles.between}>
          <ThemedText type="small" themeColor="textSecondary">
            판매량 기준 1등 기대값 {s.expected.toFixed(1)}명 → 실제 {d.ranks[0].winners}명
          </ThemedText>
          <Pill label={verdict.label} color={verdict.color} soft />
        </View>
        <ThemedText type="caption" themeColor="textTertiary">
          번호별 인기도로 추정하면 무작위 조합의 {pct >= 50 ? `${pct}%보다 덜 고르는` : `${100 - pct}%보다 많이 고르는`}{' '}
          조합이에요. 당첨 확률은 모든 조합이 같고, 많이 고르는 조합일수록 1등 상금을 여러 명이 나눠요.
        </ThemedText>
      </Card>
    </Section>
  );
}

function RankTable({ d }: { d: Draw }) {
  const theme = useTheme();
  return (
    <Section title="등수별 당첨금">
      <Card style={styles.table}>
        {d.ranks.map((r, i) => (
          <View key={i} style={[styles.tr, i < 4 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
            <View style={[styles.rankDot, { backgroundColor: `${RANK_COLORS[(i + 1) as 1]}1A` }]}>
              <ThemedText type="caption" style={{ color: RANK_COLORS[(i + 1) as 1], fontWeight: '800' }}>
                {i + 1}등
              </ThemedText>
            </View>
            <View style={styles.flex}>
              <ThemedText type="smallBold">{r.winners > 0 ? formatKRW(r.prize) : '당첨자 없음'}</ThemedText>
              <ThemedText type="caption" themeColor="textTertiary">
                {RANK_RULES[i]}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {formatCount(r.winners)}명
            </ThemedText>
          </View>
        ))}
        <ThemedText type="caption" themeColor="textTertiary" style={styles.sales}>
          총 판매액 {formatKRW(d.totalSales)} · 1인당 금액, 세전
        </ThemedText>
      </Card>
    </Section>
  );
}

function NavButton({ round, dir }: { round: number; dir: 'prev' | 'next' }) {
  const theme = useTheme();
  return (
    <PressableLink
      href={`/round/${round}`}
      style={[styles.nav, { backgroundColor: theme.backgroundElement }, dir === 'next' && styles.navNext]}>
      {dir === 'prev' && <Icon name="chevronLeft" size={16} color={theme.textSecondary} />}
      <ThemedText type="smallBold" themeColor="textSecondary">
        {round}회
      </ThemedText>
      {dir === 'next' && <Icon name="chevronRight" size={16} color={theme.textSecondary} />}
    </PressableLink>
  );
}

export default function RoundScreen() {
  const theme = useTheme();
  const { round } = useLocalSearchParams<{ round: string }>();
  const d = getDraw(Number(round));

  if (!d) {
    return (
      <Page title="회차를 찾을 수 없어요" back={{ href: '/round', label: '회차 목록' }}>
        <Button label="전체 회차 보기" onPress={() => router.push('/round')} />
      </Page>
    );
  }

  const prev = getDraw(d.round - 1);
  const next = getDraw(d.round + 1);
  const first = d.ranks[0];
  const picks = d.firstPrizePickTypes;
  const pickText =
    picks && first.winners > 0
      ? [picks.auto && `자동 ${picks.auto}`, picks.manual && `수동 ${picks.manual}`, picks.semiAuto && `반자동 ${picks.semiAuto}`]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <Page
      title={`${d.round}회 당첨번호`}
      subtitle={`${formatDateKo(d.drawDate)} 추첨`}
      back={{ href: '/round', label: '회차 목록' }}>
      <Card>
        <DrawNumbers numbers={d.numbers} bonus={d.bonus} size={42} fill />
        <View style={[styles.stats, { borderColor: theme.border }]}>
          <View style={styles.flex}>
            <ThemedText type="caption" themeColor="textTertiary">
              1등 1인당
            </ThemedText>
            <ThemedText type="heading">{first.winners > 0 ? formatKRW(first.prize) : '당첨자 없음'}</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.flex}>
            <ThemedText type="caption" themeColor="textTertiary">
              1등 당첨자
            </ThemedText>
            <ThemedText type="heading">{first.winners}명</ThemedText>
            {pickText && (
              <ThemedText type="caption" themeColor="textTertiary">
                {pickText}
              </ThemedText>
            )}
          </View>
        </View>
        <Button label="내 번호로 당첨 확인" icon="ticket" variant="primary" onPress={() => router.push(`/my?round=${d.round}`)} />
      </Card>

      <RankTable d={d} />
      <RoundStores round={d.round} firstWinners={first.winners} />
      <SharingCard d={d} />

      <View style={styles.navRow}>
        {prev ? <NavButton round={prev.round} dir="prev" /> : <View />}
        {next ? (
          <NavButton round={next.round} dir="next" />
        ) : d.round === LATEST_DRAW.round ? (
          <ThemedText type="caption" themeColor="textTertiary">
            최신 회차예요
          </ThemedText>
        ) : (
          <View />
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  flex: { flex: 1, gap: 2 },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three },
  statDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: Spacing.three },
  table: { paddingVertical: 4, gap: 0 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rankDot: { width: 40, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  sales: { paddingTop: 10, textAlign: 'right' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
  },
  navNext: {},
  pressed: { opacity: 0.7 },
});
