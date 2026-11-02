import { router, type Href } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, ListRow, Section } from '@/components/card';
import { DrawNumbers } from '@/components/draw-numbers';
import { Icon, type IconName } from '@/components/icon';
import { LottoBalls } from '@/components/lotto-ball';
import { NextDrawCountdown } from '@/components/next-draw';
import { PressableLink } from '@/components/pressable-link';
import { Page } from '@/components/page';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useLatestDraw } from '@/hooks/use-latest-draw';
import { useMyTickets } from '@/hooks/use-my-tickets';
import { useTheme } from '@/hooks/use-theme';
import { formatDateDots, formatDateKo, formatKRW } from '@/lib/format';
import { checkTicket } from '@/lib/lotto/check';
import { DRAWS_DESC } from '@/lib/lotto/draws';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateMetadata(): Metadata {
  const d = DRAWS_DESC[0];
  const title = `${SITE_NAME} - 로또 ${d.round}회 당첨번호와 남들이 안 고르는 번호`;
  const description = `로또 ${d.round}회 당첨번호 ${d.numbers.join(', ')} 보너스 ${d.bonus}. 당첨 확인, 회차별 결과, 번호 통계, 1등 판매점, 1등 상금을 나눌 사람이 적은 번호 생성기.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/` },
    openGraph: { title, description, url: `${SITE_URL}/`, siteName: SITE_NAME, type: 'website' },
  };
}

const MENU: { href: Href; title: string; desc: string; icon: IconName; color: string }[] = [
  { href: '/my', title: '당첨 확인', desc: '산 번호 맞춰 보기', icon: 'ticket', color: '#3182F6' },
  { href: '/generate', title: '번호 생성', desc: '7가지 방식', icon: 'dice', color: '#F04452' },
  { href: '/stats', title: '번호 통계', desc: '많이 나온 번호', icon: 'chart', color: '#03A65F' },
  { href: '/stats/stores', title: '1등 판매점', desc: '지역별 명당', icon: 'store', color: '#E88A00' },
];

function MenuTile({ item }: { item: (typeof MENU)[number] }) {
  return (
    <PressableLink href={item.href} style={styles.tile}>
      <Card style={styles.tileCard}>
        <View style={[styles.tileIcon, { backgroundColor: `${item.color}1A` }]}>
          <Icon name={item.icon} size={22} color={item.color} />
        </View>
        <View>
          <ThemedText type="smallBold">{item.title}</ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            {item.desc}
          </ThemedText>
        </View>
      </Card>
    </PressableLink>
  );
}

// Saved tickets for the latest draw (results) or the next one (waiting), as a one-line summary.
function MyTicketsSummary({ latestRound }: { latestRound: number }) {
  const theme = useTheme();
  const latest = useLatestDraw();
  const { tickets, loaded } = useMyTickets();
  const summary = useMemo(() => {
    const drawn = tickets.filter((t) => t.round === latestRound);
    const waiting = tickets.filter((t) => t.round === latestRound + 1).length;
    const results = drawn.map((t) => checkTicket(t.numbers, latest));
    const won = results.filter((r) => r.rank);
    return {
      drawn: drawn.length,
      won: won.length,
      prize: won.reduce((s, r) => s + r.prize, 0),
      best: Math.min(...won.map((r) => r.rank!)),
      waiting,
    };
  }, [tickets, latestRound, latest]);
  if (!loaded || (summary.drawn === 0 && summary.waiting === 0)) return null;
  const text =
    summary.drawn > 0
      ? summary.won > 0
        ? `${latestRound}회 ${summary.drawn}장 중 ${summary.won}장 당첨 · ${formatKRW(summary.prize)}`
        : `${latestRound}회 ${summary.drawn}장 확인 결과, 아쉽게 당첨이 없어요`
      : `${latestRound + 1}회 번호 ${summary.waiting}장 저장됨 · 추첨 후 자동 확인`;
  return (
    <PressableLink href="/my">
      <View style={[styles.mySummary, { backgroundColor: summary.won ? theme.primary : theme.primarySoft }]}>
        <Icon name={summary.won ? 'trophy' : 'ticket'} size={20} color={summary.won ? theme.onPrimary : theme.primary} />
        <ThemedText type="smallBold" style={[styles.flex, { color: summary.won ? theme.onPrimary : theme.primary }]}>
          {text}
        </ThemedText>
        <Icon name="chevronRight" size={16} color={summary.won ? theme.onPrimary : theme.primary} />
      </View>
    </PressableLink>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const latest = useLatestDraw();
  const first = latest.ranks[0];
  const picks = latest.firstPrizePickTypes;
  const recent = DRAWS_DESC.filter((d) => d.round < latest.round).slice(0, 5);
  const pickText =
    picks && first.winners > 0
      ? [picks.auto && `자동 ${picks.auto}`, picks.manual && `수동 ${picks.manual}`, picks.semiAuto && `반자동 ${picks.semiAuto}`]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <Page title="로또 노트" subtitle="당첨 확인부터 번호 생성까지">
      <MyTicketsSummary latestRound={latest.round} />

      <Card>
        <View style={styles.between}>
          <View>
            <ThemedText type="heading">
              <ThemedText type="heading" style={{ color: theme.primary }}>
                {latest.round}회
              </ThemedText>{' '}
              당첨번호
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              {formatDateKo(latest.drawDate)} 추첨
            </ThemedText>
          </View>
        </View>
        <DrawNumbers numbers={latest.numbers} bonus={latest.bonus} size={40} fill />
        <View style={[styles.stats, { borderColor: theme.border }]}>
          <View style={styles.stat}>
            <ThemedText type="caption" themeColor="textTertiary">
              1등 1인당
            </ThemedText>
            <ThemedText type="heading">{first.winners > 0 ? formatKRW(first.prize) : '당첨자 없음'}</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
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
        <View style={styles.row}>
          <Button
            label="내 번호 확인"
            variant="primary"
            onPress={() => router.push(`/my?round=${latest.round}`)}
            style={styles.flex}
          />
          <Button label="자세히 보기" onPress={() => router.push(`/round/${latest.round}`)} style={styles.flex} />
        </View>
      </Card>

      <Card style={styles.countdown}>
        <View style={[styles.tileIcon, { backgroundColor: theme.primarySoft }]}>
          <Icon name="clock" size={22} color={theme.primary} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="caption" themeColor="textTertiary">
            {latest.round + 1}회 추첨 · 토요일 20:35
          </ThemedText>
          <NextDrawCountdown />
        </View>
        <Button label="번호 뽑기" variant="tonal" size="sm" onPress={() => router.push('/generate')} />
      </Card>

      <View style={styles.menu}>
        {[MENU.slice(0, 2), MENU.slice(2)].map((row, i) => (
          <View key={i} style={styles.menuRow}>
            {row.map((m) => (
              <MenuTile key={m.title} item={m} />
            ))}
          </View>
        ))}
      </View>

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
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three },
  stat: { flex: 1, gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: Spacing.three },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.three },
  menu: { gap: 12 },
  menuRow: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1 },
  tileCard: { gap: 12, padding: Spacing.three },
  tileIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 4 },
  roundCol: { width: 64 },
  mySummary: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.three, borderRadius: Radius.lg },
  pressed: { opacity: 0.7 },
});
