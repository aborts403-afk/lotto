import { Link, useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { LottoBall } from '@/components/lotto-ball';
import { Page } from '@/components/page';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatCount, formatDateDots } from '@/lib/format';
import { DRAWS_DESC, getDraw } from '@/lib/lotto/draws';
import { NUMBER_WEIGHTS } from '@/lib/lotto/popularity-weights';
import { expectedCount, HOT_WINDOW, numberDetail } from '@/lib/lotto/stats';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const ALL = Array.from({ length: 45 }, (_, i) => i + 1);

function parseN(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 45 ? n : null;
}

export async function generateStaticParams(): Promise<Record<string, string>[]> {
  return ALL.map((n) => ({ n: String(n) }));
}

export const generateMetadata: GenerateMetadataFunction = (_request, params) => {
  const n = parseN(params.n as string);
  if (!n) return { title: `번호를 찾을 수 없어요 | ${SITE_NAME}` };
  const d = numberDetail(DRAWS_DESC, n);
  const title = `로또 ${n}번 통계 - 출현 ${d.count}회, 마지막 ${d.rounds[0] ?? '-'}회 | ${SITE_NAME}`;
  const description = `로또 ${n}번은 1~${DRAWS_DESC[0].round}회 동안 ${d.count}번 나왔어요 (보너스 ${d.bonusCount}번). 마지막 출현, 평균 간격, 같이 많이 나온 번호.`;
  const url = `${SITE_URL}/stats/${n}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, siteName: SITE_NAME, type: 'article' } };
};

// Popularity rank among the 45 numbers (1 = picked by the most players).
const POPULARITY_RANK = new Map(
  ALL.slice()
    .sort((a, b) => NUMBER_WEIGHTS[b - 1] - NUMBER_WEIGHTS[a - 1])
    .map((n, i) => [n, i + 1]),
);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      {sub && (
        <ThemedText type="small" themeColor="textSecondary">
          {sub}
        </ThemedText>
      )}
    </Card>
  );
}

export default function NumberScreen() {
  const n = parseN(useLocalSearchParams<{ n: string }>().n);
  const d = useMemo(() => (n ? numberDetail(DRAWS_DESC, n) : null), [n]);

  if (!n || !d) {
    return (
      <Page>
        <ThemedText type="subtitle">번호를 찾을 수 없어요</ThemedText>
        <Link href="/stats">
          <ThemedText type="linkPrimary">번호 통계로</ThemedText>
        </Link>
      </Page>
    );
  }

  const expected = expectedCount(DRAWS_DESC.length);
  const expectedRecent = expectedCount(Math.min(HOT_WINDOW, DRAWS_DESC.length));
  const popularity = Math.exp(NUMBER_WEIGHTS[n - 1]);
  const popRank = POPULARITY_RANK.get(n)!;
  const recent = d.rounds.slice(0, 8);

  return (
    <Page>
      <Link href="/stats">
        <ThemedText type="linkPrimary">← 번호 통계</ThemedText>
      </Link>

      <View style={styles.header}>
        <LottoBall n={n} size={56} />
        <View>
          <ThemedText type="subtitle">{n}번</ThemedText>
          <ThemedText themeColor="textSecondary">1~{DRAWS_DESC[0].round}회 기준</ThemedText>
        </View>
      </View>

      <View style={styles.grid}>
        <Stat label="출현 (보너스 제외)" value={`${formatCount(d.count)}회`} sub={`기대값 ${expected.toFixed(1)}회`} />
        <Stat label={`최근 ${HOT_WINDOW}회`} value={`${d.recentCount}회`} sub={`기대값 ${expectedRecent.toFixed(1)}회`} />
        <Stat
          label="마지막 출현"
          value={d.drawsSince === null ? '-' : d.drawsSince === 0 ? '이번 회차' : `${d.drawsSince}회 전`}
          sub={d.rounds[0] ? `${d.rounds[0]}회` : undefined}
        />
        <Stat label="보너스 번호로" value={`${d.bonusCount}회`} />
        <Stat label="평균 간격" value={d.averageGap ? `${d.averageGap.toFixed(1)}회` : '-'} sub="이론값 7.5회" />
        <Stat label="가장 오래 안 나온 기간" value={`${d.longestGap}회`} />
      </View>

      <Card>
        <ThemedText type="smallBold">사람들이 얼마나 고르는 번호일까?</ThemedText>
        <ThemedText type="small">
          45개 중 {popRank}번째로 많이 고르는 번호예요. 평균적인 번호보다{' '}
          {popularity >= 1 ? `${Math.round((popularity - 1) * 100)}% 더` : `${Math.round((1 - popularity) * 100)}% 덜`} 고르는
          것으로 추정돼요.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          역대 회차의 당첨자 수로 추정한 값이에요. 많이 고르는 번호로 1등이 되면 상금을 나눌 사람이 많아져요.
        </ThemedText>
      </Card>

      <Card>
        <ThemedText type="smallBold">{n}번과 같이 많이 나온 번호</ThemedText>
        <View style={styles.balls}>
          {d.companions.map((c) => (
            <Link key={c.n} href={`/stats/${c.n}`} asChild>
              <Pressable style={({ pressed }) => [styles.ballItem, pressed && styles.pressed]}>
                <LottoBall n={c.n} size={34} />
                <ThemedText type="small" themeColor="textSecondary">
                  {c.count}회
                </ThemedText>
              </Pressable>
            </Link>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          두 번호가 같이 나오는 횟수의 기대값은 {(d.count * 5 / 44).toFixed(1)}회예요. 이 정도 차이는 우연으로도 생겨요.
        </ThemedText>
      </Card>

      <View style={styles.section}>
        <ThemedText type="smallBold">최근 나온 회차</ThemedText>
        {recent.map((round) => {
          const draw = getDraw(round)!;
          return (
            <Link key={round} href={`/round/${round}`} asChild>
              <Pressable style={({ pressed }) => pressed && styles.pressed}>
                <Card>
                  <View style={styles.between}>
                    <ThemedText type="smallBold">{round}회</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDateDots(draw.drawDate)}
                    </ThemedText>
                  </View>
                  <View style={styles.balls}>
                    {draw.numbers.map((m) => (
                      <LottoBall key={m} n={m} size={28} muted={m !== n} />
                    ))}
                  </View>
                </Card>
              </Pressable>
            </Link>
          );
        })}
      </View>

      <Card>
        <ThemedText type="smallBold">다른 번호 보기</ThemedText>
        <View style={styles.balls}>
          {ALL.map((m) => (
            <Link key={m} href={`/stats/${m}`} asChild>
              <Pressable style={({ pressed }) => pressed && styles.pressed} accessibilityLabel={`${m}번 통계`}>
                <LottoBall n={m} size={32} muted={m === n} />
              </Pressable>
            </Link>
          ))}
        </View>
      </Card>

      <ThemedText type="small" themeColor="textSecondary">
        추첨은 매번 완전한 무작위라서, 지난 기록이 다음 번호에 영향을 주지는 않아요.
      </ThemedText>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stat: { flexGrow: 1, flexBasis: 150, gap: 2 },
  statValue: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  balls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ballItem: { alignItems: 'center', gap: 2 },
  section: { gap: Spacing.two },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pressed: { opacity: 0.7 },
});
