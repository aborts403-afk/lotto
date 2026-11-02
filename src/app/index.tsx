import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ListRow, Pill, Section } from '@/components/card';
import { DrawNumbers } from '@/components/draw-numbers';
import { HERO_BLUE } from '@/components/draw-hero';
import { Icon, type IconName } from '@/components/icon';
import { LottoBall, LottoBalls } from '@/components/lotto-ball';
import { NextDrawCountdownInline } from '@/components/next-draw';
import { PressableLink } from '@/components/pressable-link';
import { Page } from '@/components/page';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useWideWeb } from '@/hooks/use-layout';
import { useAllDraws, useLatestDraw } from '@/hooks/use-latest-draw';
import { useMyTickets } from '@/hooks/use-my-tickets';
import { useTheme } from '@/hooks/use-theme';
import { formatDateDots, formatKRW, formatKRWShort } from '@/lib/format';
import { checkTicket } from '@/lib/lotto/check';
import { DRAWS_DESC, firstPrizeSharing } from '@/lib/lotto/draws';
import { generate } from '@/lib/lotto/generator';
import { estimatePayout } from '@/lib/lotto/payout';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateMetadata(): Metadata {
  const d = DRAWS_DESC[0];
  const title = `${SITE_NAME} - 1등이 되면 덜 나누는 로또 번호, ${d.round}회 당첨번호`;
  const description = `당첨 확률은 같아도 나눌 사람 수는 달라요. 남들이 안 고르는 번호와 1등 예상 실수령액, 내 번호 진단. 로또 ${d.round}회 당첨번호 ${d.numbers.join(', ')} 보너스 ${d.bonus}.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/` },
    openGraph: { title, description, url: `${SITE_URL}/`, siteName: SITE_NAME, type: 'website' },
  };
}

const WHITE_SOFT = 'rgba(255,255,255,0.85)';

// This week's recommended combination (least popular) with its expected after-tax 1st prize.
function RecommendHero({ nextRound }: { nextRound: number }) {
  const hydrated = useHydrated();
  const draws = useAllDraws();
  const [roll, setRoll] = useState(0);
  // Random, so made after hydration (the static HTML shows empty slots).
  const pick = useMemo(() => {
    if (!hydrated) return null;
    const numbers = generate({ mode: 'unpopular', count: 1 }).sets[0].numbers;
    return { numbers, payout: estimatePayout(numbers, draws) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `roll` asks for another set
  }, [hydrated, draws, roll]);
  const gain = pick ? pick.payout.net - pick.payout.averageNet : 0;

  return (
    <View style={styles.hero}>
      <ThemedText type="caption" style={[styles.bold, { color: WHITE_SOFT }]}>
        확률은 누구나 같아요. 나누는 사람 수는 달라요.
      </ThemedText>
      <ThemedText style={[styles.white, styles.heroTitle]}>{'1등이 되면\n덜 나누는 번호'}</ThemedText>

      <View style={styles.gap8}>
        <View style={styles.between}>
          <ThemedText type="caption" style={[styles.bold, { color: WHITE_SOFT }]}>
            {nextRound}회 추천 번호
          </ThemedText>
          <NextDrawCountdownInline style={{ color: WHITE_SOFT }} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다른 번호 보기"
          onPress={() => setRoll((r) => r + 1)}
          style={styles.heroBalls}>
          {pick
            ? pick.numbers.map((n) => <LottoBall key={n} n={n} size={40} outline="rgba(255,255,255,0.9)" />)
            : Array.from({ length: 6 }, (_, i) => <View key={i} style={styles.heroSlot} />)}
        </Pressable>
      </View>

      <View style={styles.payoutBox}>
        <View style={styles.gap2}>
          <ThemedText type="caption" style={{ color: WHITE_SOFT }}>
            이 번호로 1등이면 예상 실수령액
          </ThemedText>
          <ThemedText style={[styles.white, styles.payoutValue]}>
            {pick ? `약 ${formatKRWShort(pick.payout.net)}` : '계산 중'}
          </ThemedText>
        </View>
        {pick && gain > 0 && (
          <View style={styles.gainPill}>
            <ThemedText type="caption" style={[styles.bold, { color: HERO_BLUE }]}>
              평균보다 +{formatKRWShort(gain)}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/generate')}
          style={({ pressed }) => [styles.heroButton, styles.heroPrimary, pressed && styles.pressed]}>
          <ThemedText style={[styles.heroButtonText, { color: HERO_BLUE }]}>5세트 더 뽑기</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/diagnose')}
          style={({ pressed }) => [styles.heroButton, styles.heroSecondary, pressed && styles.pressed]}>
          <ThemedText style={[styles.heroButtonText, styles.white]}>내 번호 진단</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

// Saved tickets for the latest draw (results) or the next one (waiting).
function MyTicketsCard({ latestRound }: { latestRound: number }) {
  const theme = useTheme();
  const latest = useLatestDraw();
  const { tickets, loaded } = useMyTickets();
  const summary = useMemo(() => {
    const drawn = tickets.filter((t) => t.round === latestRound);
    const waiting = tickets.filter((t) => t.round === latestRound + 1).length;
    const won = drawn.map((t) => checkTicket(t.numbers, latest)).filter((r) => r.rank);
    return { drawn: drawn.length, won: won.length, prize: won.reduce((sum, r) => sum + r.prize, 0), waiting };
  }, [tickets, latestRound, latest]);
  if (!loaded || (summary.drawn === 0 && summary.waiting === 0)) return null;

  const won = summary.won > 0;
  const caption =
    summary.drawn > 0 ? `내 번호 · ${latestRound}회 ${summary.drawn}장` : `내 번호 · ${latestRound + 1}회 ${summary.waiting}장`;
  const title =
    summary.drawn > 0
      ? won
        ? `${summary.won}장 당첨, ${formatKRW(summary.prize)}`
        : '아쉽게 당첨이 없어요'
      : '추첨이 끝나면 바로 확인돼요';
  const color = won ? theme.success : theme.primary;
  return <RowCard href="/my" icon={won ? 'trophy' : 'ticket'} color={color} caption={caption} title={title} />;
}

function RowCard({
  href,
  icon,
  color,
  caption,
  title,
}: {
  href: Href;
  icon: IconName;
  color: string;
  caption: string;
  title: string;
}) {
  const theme = useTheme();
  return (
    <PressableLink href={href}>
      <Card style={styles.rowCard}>
        <View style={[styles.iconBox, { backgroundColor: `${color}1A` }]}>
          <Icon name={icon} size={22} color={color} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="caption" themeColor="textTertiary">
            {caption}
          </ThemedText>
          <ThemedText style={styles.cardTitle}>{title}</ThemedText>
        </View>
        <Icon name="chevronRight" size={18} color={theme.textTertiary} />
      </Card>
    </PressableLink>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const latest = useLatestDraw();
  const recent = DRAWS_DESC.filter((d) => d.round < latest.round).slice(0, 5);
  // The desktop web top bar already shows the name.
  const wide = useWideWeb();
  const first = latest.ranks[0];
  const sharing = firstPrizeSharing(latest);
  const verdict = {
    popular: { label: '많이 고른 조합', color: theme.danger },
    average: { label: '평균 수준', color: theme.textTertiary },
    unpopular: { label: '적게 고른 조합', color: theme.success },
  }[sharing.verdict];

  return (
    <Page>
      {!wide && (
        <View style={styles.brand}>
          <Image source={require('@/assets/images/logo-96.png')} style={styles.logo} accessibilityIgnoresInvertColors />
          <ThemedText style={styles.brandText}>{SITE_NAME}</ThemedText>
        </View>
      )}

      <RecommendHero nextRound={latest.round + 1} />

      <MyTicketsCard latestRound={latest.round} />
      <RowCard
        href="/diagnose"
        icon="diagnose"
        color={theme.warning}
        caption="늘 사는 번호가 있나요?"
        title="몇 명과 나누게 될지 알려 드려요"
      />
      <RowCard
        href="/stats/simulator"
        icon="refresh"
        color={theme.success}
        caption="역대 결과로 계산"
        title="이 번호로 20년 샀다면?"
      />

      <PressableLink href={`/round/${latest.round}`}>
        <Card style={styles.latest}>
          <View style={styles.between}>
            <ThemedText type="smallBold">{latest.round}회 결과</ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              {formatDateDots(latest.drawDate)}
            </ThemedText>
          </View>
          <DrawNumbers numbers={latest.numbers} bonus={latest.bonus} size={34} fill />
          <View style={styles.between}>
            <ThemedText type="caption" themeColor="textSecondary">
              {first.winners > 0 ? `1등 ${first.winners}명 · 1인당 ${formatKRW(first.prize)}` : '1등 당첨자 없음'}
            </ThemedText>
            <Pill label={verdict.label} color={verdict.color} soft />
          </View>
        </Card>
      </PressableLink>

      <Section title="지난 회차" action={{ label: '전체 보기', href: '/round' }}>
        <Card style={styles.list}>
          {recent.map((d, i) => (
            <ListRow
              key={d.round}
              href={`/round/${d.round}`}
              last={i === recent.length - 1}
              left={
                <View style={styles.roundCol}>
                  <ThemedText type="smallBold">{d.round}회</ThemedText>
                  <ThemedText type="caption" themeColor="textTertiary">
                    {formatDateDots(d.drawDate).slice(2)}
                  </ThemedText>
                </View>
              }
              title={<LottoBalls numbers={d.numbers} size={26} />}
            />
          ))}
        </Card>
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 1 },
  white: { color: '#FFFFFF' },
  bold: { fontWeight: '700' },
  gap2: { gap: 2 },
  gap8: { gap: 8 },
  pressed: { opacity: 0.8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  logo: { width: 30, height: 30, borderRadius: 9 },
  brandText: { fontSize: 19, lineHeight: 26, fontWeight: '900', letterSpacing: -0.5 },
  hero: { backgroundColor: HERO_BLUE, borderRadius: Radius.lg + 4, padding: 20, paddingTop: 22, gap: 14 },
  heroTitle: { fontSize: 28, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  heroBalls: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  heroSlot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  payoutBox: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  payoutValue: { fontSize: 20, lineHeight: 28, fontWeight: '900' },
  gainPill: { backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  heroButton: { flex: 1, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  heroPrimary: { backgroundColor: '#FFFFFF' },
  heroSecondary: { backgroundColor: 'rgba(255,255,255,0.16)' },
  heroButtonText: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.three },
  iconBox: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  latest: { gap: 12 },
  list: { paddingVertical: 4 },
  roundCol: { width: 64 },
});
