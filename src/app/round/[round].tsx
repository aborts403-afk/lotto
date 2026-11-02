import { Link, useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { DrawNumbers } from '@/components/draw-numbers';
import { Page } from '@/components/page';
import { RoundStores } from '@/components/round-stores';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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

const RANK_RULES = ['6개 번호 일치', '5개 번호 + 보너스 번호 일치', '5개 번호 일치', '4개 번호 일치', '3개 번호 일치'];

const SHARING_TEXT = {
  popular: { label: '많은 사람이 고른 조합', color: '#E5484D' },
  average: { label: '평균 수준', color: '#8B8D98' },
  unpopular: { label: '적은 사람이 고른 조합', color: '#30A46C' },
} as const;

function SharingCard({ d }: { d: Draw }) {
  const s = firstPrizeSharing(d);
  const t = SHARING_TEXT[s.verdict];
  const pct = lessPopularThanPercent(d.numbers);
  return (
    <Card>
      <View style={styles.between}>
        <ThemedText type="smallBold">이 번호는 인기 조합이었을까?</ThemedText>
        <ThemedText type="smallBold" style={{ color: t.color }}>
          {t.label}
        </ThemedText>
      </View>
      <ThemedText type="small">
        판매량으로 계산한 무작위 기대값은 1등 {s.expected.toFixed(1)}명인데, 실제로는 {d.ranks[0].winners}명이
        나왔어요{s.verdict === 'average' ? '.' : ` (기대값의 ${s.ratio.toFixed(1)}배).`}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        번호별 인기도로 추정하면, 이 조합은 무작위 조합의{' '}
        {pct >= 50 ? `${pct}%보다 덜 인기 있는` : `${100 - pct}%보다 인기 있는`} 조합이에요. 당첨 확률은 모든 조합이
        같고, 인기 조합일수록 1등 상금을 나눠 갖는 사람이 많아져요.
      </ThemedText>
    </Card>
  );
}

function RankTable({ d }: { d: Draw }) {
  return (
    <Card style={{ gap: 0 }}>
      <View style={[styles.tr, styles.th]}>
        <ThemedText type="smallBold" style={styles.cRank}>등수</ThemedText>
        <ThemedText type="smallBold" style={styles.cNum}>당첨자</ThemedText>
        <ThemedText type="smallBold" style={styles.cNum}>1인당 당첨금</ThemedText>
      </View>
      {d.ranks.map((r, i) => (
        <View key={i} style={styles.tr}>
          <View style={styles.cRank}>
            <ThemedText type="smallBold">{i + 1}등</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.rule}>
              {RANK_RULES[i]}
            </ThemedText>
          </View>
          <ThemedText type="small" style={styles.cNum}>{formatCount(r.winners)}명</ThemedText>
          <ThemedText type="small" style={styles.cNum}>{r.winners > 0 ? formatKRW(r.prize) : '-'}</ThemedText>
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary" style={styles.sales}>
        총 판매액 {formatKRW(d.totalSales)}
      </ThemedText>
    </Card>
  );
}

export default function RoundScreen() {
  const { round } = useLocalSearchParams<{ round: string }>();
  const d = getDraw(Number(round));

  if (!d) {
    return (
      <Page>
        <ThemedText type="subtitle">회차를 찾을 수 없어요</ThemedText>
        <Link href="/round">
          <ThemedText type="linkPrimary">전체 회차 보기</ThemedText>
        </Link>
      </Page>
    );
  }

  const prev = getDraw(d.round - 1);
  const next = getDraw(d.round + 1);
  const first = d.ranks[0];

  return (
    <Page>
      <Link href="/round">
        <ThemedText type="linkPrimary">← 전체 회차</ThemedText>
      </Link>

      <View style={styles.header}>
        <ThemedText type="subtitle">{d.round}회 당첨번호</ThemedText>
        <ThemedText themeColor="textSecondary">{formatDateKo(d.drawDate)} 추첨</ThemedText>
      </View>

      <DrawNumbers numbers={d.numbers} bonus={d.bonus} size={38} />

      <Card>
        <ThemedText type="small" themeColor="textSecondary">1등 1인당 당첨금</ThemedText>
        <ThemedText style={styles.big}>{first.winners > 0 ? formatKRW(first.prize) : '당첨자 없음'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">1등 {first.winners}명</ThemedText>
      </Card>

      <SharingCard d={d} />
      <RankTable d={d} />
      <RoundStores round={d.round} firstWinners={first.winners} />

      <Link href={`/my?round=${d.round}`}>
        <ThemedText type="linkPrimary">내 번호로 {d.round}회 당첨 확인 →</ThemedText>
      </Link>

      <View style={styles.between}>
        {prev ? (
          <Link href={`/round/${prev.round}`}>
            <ThemedText type="linkPrimary">← {prev.round}회</ThemedText>
          </Link>
        ) : (
          <View />
        )}
        {next ? (
          <Link href={`/round/${next.round}`}>
            <ThemedText type="linkPrimary">{next.round}회 →</ThemedText>
          </Link>
        ) : d.round === LATEST_DRAW.round ? (
          <ThemedText type="small" themeColor="textSecondary">최신 회차</ThemedText>
        ) : (
          <View />
        )}
      </View>

      <Link href="/generate">
        <ThemedText type="linkPrimary">남들이 잘 안 고르는 번호 뽑아보기 →</ThemedText>
      </Link>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  big: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two, gap: Spacing.two },
  th: { paddingTop: 0 },
  cRank: { flex: 1.4 },
  cNum: { flex: 1, textAlign: 'right' },
  rule: { fontSize: 12, lineHeight: 16 },
  sales: { marginTop: Spacing.two, textAlign: 'right' },
});
