import { Link } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DrawNumbers } from '@/components/draw-numbers';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatDateDots, formatKRW } from '@/lib/format';
import { DRAWS_DESC, LATEST_DRAW, type Draw } from '@/lib/lotto/draws';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateMetadata(): Metadata {
  const title = `로또 회차별 당첨번호 전체 (1~${LATEST_DRAW.round}회) | ${SITE_NAME}`;
  const description = `로또 6/45 1회부터 최신 ${LATEST_DRAW.round}회까지 회차별 당첨번호, 보너스 번호, 1등 당첨금과 당첨자 수.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/round` },
    openGraph: { title, description, url: `${SITE_URL}/round`, siteName: SITE_NAME, type: 'website' },
  };
}

function Row({ d }: { d: Draw }) {
  return (
    <Link href={`/round/${d.round}`} asChild>
      <Pressable style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.row}>
          <View style={styles.rowHeader}>
            <ThemedText type="smallBold">{d.round}회</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateDots(d.drawDate)} · 1등 {d.ranks[0].winners}명
              {d.ranks[0].winners > 0 ? ` · ${formatKRW(d.ranks[0].prize)}` : ''}
            </ThemedText>
          </View>
          <DrawNumbers numbers={d.numbers} bonus={d.bonus} size={30} />
        </ThemedView>
      </Pressable>
    </Link>
  );
}

export default function RoundListScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={DRAWS_DESC}
        keyExtractor={(d) => String(d.round)}
        renderItem={({ item }) => <Row d={item} />}
        initialNumToRender={20}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="subtitle">회차별 당첨번호</ThemedText>
            <ThemedText themeColor="textSecondary">1회부터 {LATEST_DRAW.round}회까지</ThemedText>
          </View>
        }
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four, gap: Spacing.two },
  header: { gap: Spacing.one, marginBottom: Spacing.three },
  row: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  pressed: { opacity: 0.7 },
});
