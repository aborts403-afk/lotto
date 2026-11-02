import type { Metadata } from 'expo-router/server';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PressableLink } from '@/components/pressable-link';
import { BarList } from '@/components/bar-list';
import { Card, Notice, Pill, Section } from '@/components/card';
import { Icon } from '@/components/icon';
import { Chips } from '@/components/chips';
import { MapButton } from '@/components/map-button';
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

function StoreItem({ store, rank, last }: { store: StoreRow; rank: number; last: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const rounds = [...new Set(store.firstRounds)];
  const picks = [
    store.auto && `자동 ${store.auto}`,
    store.manual && `수동 ${store.manual}`,
    store.semiAuto && `반자동 ${store.semiAuto}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={!last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [styles.storeHead, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={[styles.rank, rank <= 3 && { color: theme.primary }]}>
          {rank}
        </ThemedText>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {store.name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary" numberOfLines={open ? undefined : 1}>
            {store.address ?? '온라인 판매'}
          </ThemedText>
        </View>
        <View style={styles.counts}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            1등 {store.first}
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            2등 {formatCount(store.second)}
          </ThemedText>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={16} color={theme.textTertiary} />
        </View>
      </Pressable>
      {open && (
        <View style={styles.detail}>
          <View style={styles.pills}>
            {store.closed && <Pill label="폐점" color={theme.textTertiary} soft />}
            <ThemedText type="caption" themeColor="textSecondary">
              1등 {rounds.length}개 회차{rounds.length < store.first ? ' (한 회차 여러 장 포함)' : ''}
              {picks ? ` · ${picks}` : ''}
            </ThemedText>
          </View>
          {store.address && (
            <View style={styles.mapRow}>
              <MapButton place={{ name: store.name, address: store.address }} label="네이버 지도에서 보기" />
            </View>
          )}
          <View style={styles.rounds}>
            {rounds.map((r) => (
              <PressableLink
                key={r}
                href={`/round/${r}`}
                style={[styles.roundChip, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="caption" themeColor="textSecondary">
                  {r}회
                </ThemedText>
              </PressableLink>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export default function StoresScreen() {
  const theme = useTheme();
  const [region, setRegion] = useState(ALL);
  const regions = STORES.regions.filter((r) => r.region in STORES.byRegion);
  const list = region === ALL ? STORES.top : (STORES.byRegion[region] ?? []);
  const maxFirst = Math.max(...STORES.regions.map((r) => r.first));

  return (
    <Page
      title="1등 당첨 판매점"
      subtitle={`${STORES.fromRound}~${STORES.toRound}회 1등 ${formatCount(STORES.firstTickets)}장 기준`}
      back={{ href: '/stats', label: '번호 통계' }}>
      <Card style={styles.summary}>
        <View style={styles.summaryItem}>
          <ThemedText type="caption" themeColor="textTertiary">
            1등 나온 판매점
          </ThemedText>
          <ThemedText type="heading">{formatCount(STORES.firstStores)}곳</ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryItem}>
          <ThemedText type="caption" themeColor="textTertiary">
            두 번 이상
          </ThemedText>
          <ThemedText type="heading">{formatCount(STORES.repeatStores)}곳</ThemedText>
        </View>
      </Card>
      <Notice>1등이 많이 나온 곳은 대부분 그만큼 많이 파는 곳이에요. 어느 판매점에서 사든 한 장의 당첨 확률은 같아요.</Notice>

      <Section title="1등 많이 나온 판매점" description="누르면 1등이 나온 회차를 볼 수 있어요">
        <Chips
          options={[ALL, ...regions.map((r) => r.region)].map((r) => ({ value: r, label: r }))}
          value={region}
          onChange={setRegion}
          scroll
        />
        <Card style={styles.list}>
          {list.map((s, i) => (
            <StoreItem key={s.id} store={s} rank={i + 1} last={i === list.length - 1} />
          ))}
        </Card>
        <ThemedText type="caption" themeColor="textTertiary">
          상호와 주소는 가장 최근 당첨 때 기준이에요. 한 사람이 같은 번호를 여러 장 사서 1등이 되면 여러 번으로 세요.
        </ThemedText>
      </Section>

      <Section title="지역별 1등" description="광주·전남은 옛 기록이 묶여 있어 합쳐서 셌어요">
        <Card>
          <BarList
            labelWidth={64}
            rows={STORES.regions.map((r) => ({
              key: r.region,
              label: r.region,
              value: r.first / maxFirst,
              valueLabel: formatCount(r.first),
            }))}
          />
        </Card>
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
  summary: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.three },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  list: { paddingVertical: 4, gap: 0 },
  storeHead: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14 },
  rank: { width: 22, textAlign: 'center' },
  counts: { alignItems: 'flex-end' },
  detail: { gap: 10, paddingLeft: 34, paddingBottom: 14 },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  mapRow: { flexDirection: 'row' },
  rounds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roundChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
});
