import { Link, type Href } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { DrawNumbers } from '@/components/draw-numbers';
import { NextDrawCountdown } from '@/components/next-draw';
import { Page } from '@/components/page';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLatestDraw } from '@/hooks/use-latest-draw';
import { formatDateDots, formatDateKo, formatKRW } from '@/lib/format';
import { DRAWS_DESC } from '@/lib/lotto/draws';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateMetadata(): Metadata {
  const d = DRAWS_DESC[0];
  const title = `${SITE_NAME} - 로또 ${d.round}회 당첨번호와 남들이 안 고르는 번호`;
  const description = `로또 ${d.round}회 당첨번호 ${d.numbers.join(', ')} 보너스 ${d.bonus}. 회차별 결과, 번호 통계, 1등 상금을 나눌 사람이 적은 번호 생성기.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/` },
    openGraph: { title, description, url: `${SITE_URL}/`, siteName: SITE_NAME, type: 'website' },
  };
}

const LINKS: { href: Href; title: string; desc: string }[] = [
  { href: '/generate', title: '번호 생성', desc: '남들이 잘 안 고르는 번호' },
  { href: '/round', title: '회차별 당첨번호', desc: '1회부터 최신 회차까지' },
  { href: '/stats', title: '번호 통계', desc: '많이 나온 번호, 홀짝 비율' },
];

export default function HomeScreen() {
  const latest = useLatestDraw();
  const first = latest.ranks[0];
  const picks = latest.firstPrizePickTypes;
  const recent = DRAWS_DESC.filter((d) => d.round < latest.round).slice(0, 4);

  return (
    <Page>
      <View style={styles.header}>
        <ThemedText type="subtitle">로또 노트</ThemedText>
        <ThemedText themeColor="textSecondary">확률은 같지만, 당첨되면 혼자 다 가져가는 번호</ThemedText>
      </View>

      <Card style={styles.latest}>
        <View style={styles.between}>
          <ThemedText type="smallBold">{latest.round}회 당첨번호</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{formatDateKo(latest.drawDate)}</ThemedText>
        </View>
        <DrawNumbers numbers={latest.numbers} bonus={latest.bonus} size={34} />
        <ThemedText type="small">
          1등 {first.winners}명{first.winners > 0 ? ` · 1인당 ${formatKRW(first.prize)}` : ''}
          {picks && first.winners > 0
            ? ` (자동 ${picks.auto}${picks.manual ? ` · 수동 ${picks.manual}` : ''}${picks.semiAuto ? ` · 반자동 ${picks.semiAuto}` : ''})`
            : ''}
        </ThemedText>
        <Link href={`/round/${latest.round}`}>
          <ThemedText type="linkPrimary">당첨금과 인기 조합 분석 보기 →</ThemedText>
        </Link>
      </Card>

      <Card>
        <ThemedText type="small" themeColor="textSecondary">{latest.round + 1}회 추첨까지</ThemedText>
        <NextDrawCountdown />
        <ThemedText type="small" themeColor="textSecondary">매주 토요일 오후 8시 35분경 추첨</ThemedText>
      </Card>

      <View style={styles.links}>
        {LINKS.map((l) => (
          <Link key={l.title} href={l.href} asChild>
            <Pressable style={({ pressed }) => [styles.linkItem, pressed && styles.pressed]}>
              <Card style={styles.linkCard}>
                <ThemedText type="smallBold">{l.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{l.desc}</ThemedText>
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">지난 회차</ThemedText>
        {recent.map((d) => (
          <Link key={d.round} href={`/round/${d.round}`} asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <Card>
                <View style={styles.between}>
                  <ThemedText type="smallBold">{d.round}회</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDateDots(d.drawDate)} · 1등 {d.ranks[0].winners}명
                  </ThemedText>
                </View>
                <DrawNumbers numbers={d.numbers} bonus={d.bonus} size={30} />
              </Card>
            </Pressable>
          </Link>
        ))}
        <Link href="/round">
          <ThemedText type="linkPrimary">전체 회차 보기 →</ThemedText>
        </Link>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  latest: { gap: Spacing.three },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  linkItem: { flexGrow: 1, flexBasis: 160 },
  linkCard: { gap: 2 },
  section: { gap: Spacing.two },
  pressed: { opacity: 0.7 },
});
