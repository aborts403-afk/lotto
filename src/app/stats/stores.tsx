import { Link } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Chips } from '@/components/chips';
import { Page } from '@/components/page';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCount } from '@/lib/format';
import { STORES, type StoreRow } from '@/lib/lotto/stores';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateMetadata(): Metadata {
  const top = STORES.top.filter((s) => s.address).slice(0, 3);
  const title = `로또 1등 많이 나온 판매점 순위 - 지역별 명당 | ${SITE_NAME}`;
  const description = `${STORES.fromRound}~${STORES.toRound}회 로또 1등 ${formatCount(STORES.firstTickets)}장이 나온 판매점 순위. ${top
    .map((s) => `${s.name} ${s.first}번`)
    .join(', ')}. 지역별 1등 판매점과 당첨 회차.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/stats/stores` },
    openGraph: { title, description, url: `${SITE_URL}/stats/stores`, siteName: SITE_NAME, type: 'website' },
  };
}

const ALL = '전체';

function StoreItem({ store, rank }: { store: StoreRow; rank: number }) {
  const [open, setOpen] = useState(false);
  const rounds = [...new Set(store.firstRounds)];
  const picks = [store.auto && `자동 ${store.auto}`, store.manual && `수동 ${store.manual}`, store.semiAuto && `반자동 ${store.semiAuto}`]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={({ pressed }) => pressed && styles.pressed}>
      <Card>
        <View style={styles.storeHead}>
          <ThemedText type="smallBold" style={styles.rank}>
            {rank}
          </ThemedText>
          <View style={styles.flex}>
            <ThemedText type="smallBold">
              {store.name}
              {store.closed ? <ThemedText type="small" themeColor="textSecondary">  폐점</ThemedText> : null}
            </ThemedText>
            {store.address && (
              <ThemedText type="small" themeColor="textSecondary">
                {store.address}
              </ThemedText>
            )}
          </View>
          <View style={styles.counts}>
            <ThemedText type="smallBold">1등 {store.first}번</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              2등 {formatCount(store.second)}번
            </ThemedText>
          </View>
        </View>
        {open && (
          <View style={styles.detail}>
            <ThemedText type="small" themeColor="textSecondary">
              1등 {rounds.length}개 회차{rounds.length < store.first ? ` (한 회차에 여러 장 나온 적 있음)` : ''}
              {picks ? ` · ${picks}` : ''}
            </ThemedText>
            <View style={styles.rounds}>
              {rounds.map((r) => (
                <Link key={r} href={`/round/${r}`}>
                  <ThemedText type="small" style={styles.roundLink}>
                    {r}회
                  </ThemedText>
                </Link>
              ))}
            </View>
          </View>
        )}
      </Card>
    </Pressable>
  );
}

export default function StoresScreen() {
  const theme = useTheme();
  const [region, setRegion] = useState(ALL);
  const regions = STORES.regions.filter((r) => r.region in STORES.byRegion);
  const list = region === ALL ? STORES.top : (STORES.byRegion[region] ?? []);
  const maxFirst = Math.max(...STORES.regions.map((r) => r.first));

  return (
    <Page>
      <Link href="/stats">
        <ThemedText type="linkPrimary">← 번호 통계</ThemedText>
      </Link>

      <View style={styles.header}>
        <ThemedText type="subtitle">1등 당첨 판매점</ThemedText>
        <ThemedText themeColor="textSecondary">
          {STORES.fromRound}~{STORES.toRound}회 1등 {formatCount(STORES.firstTickets)}장 기준
        </ThemedText>
      </View>

      <Card>
        <ThemedText type="small">
          1등이 나온 판매점 {formatCount(STORES.firstStores)}곳 중 {formatCount(STORES.repeatStores)}곳이 두 번 이상 1등을 냈어요.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          1등이 많이 나온 곳은 대부분 그만큼 많이 파는 곳이에요. 어느 판매점에서 사든 한 장의 당첨 확률은 같아요. 한 사람이
          같은 번호를 여러 장 사서 1등이 되면 여러 번으로 세요.
        </ThemedText>
      </Card>

      <View style={styles.section}>
        <ThemedText type="smallBold">지역별 1등</ThemedText>
        {STORES.regions.map((r) => (
          <View key={r.region} style={styles.regionRow}>
            <ThemedText type="small" style={styles.regionLabel}>
              {r.region}
            </ThemedText>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${(r.first / maxFirst) * 100}%`, backgroundColor: theme.chartSeries }]} />
            </View>
            <ThemedText type="small" style={styles.regionValue}>
              {formatCount(r.first)}
            </ThemedText>
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          주소가 없는 옛 기록은 빠져 있어요. 광주와 전남은 예전 기록이 하나로 묶여 있어서 합쳐서 셌어요.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">1등 많이 나온 판매점</ThemedText>
        <Chips options={[ALL, ...regions.map((r) => r.region)].map((r) => ({ value: r, label: r }))} value={region} onChange={setRegion} />
        {list.map((s, i) => (
          <StoreItem key={s.id} store={s} rank={i + 1} />
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          판매점을 누르면 1등이 나온 회차를 볼 수 있어요. 상호와 주소는 가장 최근 당첨 때 기준이에요.
        </ThemedText>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  section: { gap: Spacing.two },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  storeHead: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  rank: { width: 24, textAlign: 'center' },
  counts: { alignItems: 'flex-end' },
  detail: { gap: Spacing.two, paddingLeft: 32 },
  rounds: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.two },
  roundLink: { color: '#3c87f7' },
  regionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  regionLabel: { width: 72 },
  track: { flex: 1, height: 12, justifyContent: 'center' },
  bar: { height: 12, borderTopRightRadius: 4, borderBottomRightRadius: 4, minWidth: 1 },
  regionValue: { width: 48, textAlign: 'right' },
});
