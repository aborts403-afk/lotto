import { router } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { PressableLink } from '@/components/pressable-link';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DrawNumbers } from '@/components/draw-numbers';
import { Icon } from '@/components/icon';
import { NumberPicker } from '@/components/number-picker';
import { PageHeader } from '@/components/page';
import { RecordsTabs } from '@/components/tab-strip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
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

function Row({ d, highlight }: { d: Draw; highlight?: readonly number[] }) {
  const theme = useTheme();
  const first = d.ranks[0];
  return (
    <PressableLink href={`/round/${d.round}`}>
      <Card style={styles.row}>
        <View style={styles.rowHead}>
          <ThemedText type="smallBold">{d.round}회</ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            {formatDateDots(d.drawDate)}
          </ThemedText>
          <View style={styles.flex} />
          <ThemedText type="caption" themeColor="textSecondary">
            {first.winners > 0 ? `1등 ${first.winners}명 · ${formatKRW(first.prize)}` : '1등 없음'}
          </ThemedText>
          <Icon name="chevronRight" size={14} color={theme.textTertiary} />
        </View>
        <DrawNumbers numbers={d.numbers} bonus={d.bonus} size={34} highlight={highlight} fill />
      </Card>
    </PressableLink>
  );
}

export default function RoundListScreen() {
  const insets = useScreenInsets();
  const theme = useTheme();
  const [roundText, setRoundText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<number[]>([]);

  const data = useMemo(
    () => (filter.length ? DRAWS_DESC.filter((d) => filter.every((n) => d.numbers.includes(n) || d.bonus === n)) : DRAWS_DESC),
    [filter],
  );

  const go = () => {
    const n = Number(roundText);
    if (!Number.isInteger(n) || n < 1 || n > LATEST_DRAW.round) {
      setError(`1~${LATEST_DRAW.round} 사이의 회차를 넣어 주세요`);
      return;
    }
    setError(null);
    router.push(`/round/${n}`);
  };
  const toggle = (n: number) =>
    setFilter((f) => (f.includes(n) ? f.filter((x) => x !== n) : f.length >= 6 ? f : [...f, n].sort((a, b) => a - b)));

  const header = (
    <View style={styles.header}>
      <PageHeader title="기록" subtitle={`회차 결과 · 1회부터 ${LATEST_DRAW.round}회까지`} />
      <RecordsTabs />
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="search" size={18} color={theme.textTertiary} />
          <TextInput
            value={roundText}
            onChangeText={(v) => {
              setRoundText(v.replace(/\D/g, '').slice(0, 5));
              setError(null);
            }}
            onSubmitEditing={go}
            placeholder="회차 번호로 이동"
            placeholderTextColor={theme.textTertiary}
            keyboardType="number-pad"
            returnKeyType="go"
            accessibilityLabel="회차 번호"
            style={[styles.searchInput, { color: theme.text }]}
          />
          {roundText ? <Button label="이동" size="sm" variant="primary" onPress={go} /> : null}
        </View>
        <Button
          icon="tune"
          accessibilityLabel="번호로 찾기"
          variant={filterOpen || filter.length ? 'tonal' : 'secondary'}
          onPress={() => setFilterOpen(!filterOpen)}
          style={!filterOpen && !filter.length ? { backgroundColor: theme.backgroundElement } : undefined}
        />
      </View>
      {error && (
        <ThemedText type="caption" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      )}
      {filterOpen && (
        <Card>
          <View style={styles.between}>
            <ThemedText type="heading">번호로 찾기</ThemedText>
            {filter.length > 0 && <Button label="초기화" size="sm" variant="ghost" onPress={() => setFilter([])} />}
          </View>
          <ThemedText type="caption" themeColor="textTertiary">
            고른 번호가 모두 나온 회차만 보여요 (보너스 포함, 최대 6개).
          </ThemedText>
          <NumberPicker fixed={filter} onPress={toggle} />
        </Card>
      )}
      {filter.length > 0 && (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.resultCount}>
          {filter.join(', ')} 포함 회차 {data.length}개
        </ThemedText>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(d) => String(d.round)}
        renderItem={({ item }) => <Row d={item} highlight={filter.length ? filter : undefined} />}
        initialNumToRender={12}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Card style={styles.empty}>
            <ThemedText type="small" themeColor="textSecondary">
              고른 번호가 모두 나온 회차가 없어요.
            </ThemedText>
          </Card>
        }
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth + Spacing.three * 2,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    gap: 10,
  },
  // Same spacing as <Page>: 16 between header blocks; 6 + the list's 10 gap = 16 before the first row.
  header: { gap: Spacing.three, marginBottom: 6 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flex: { flex: 1 },
  searchRow: { flexDirection: 'row', gap: Spacing.two },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingLeft: 14,
    paddingRight: 6,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  resultCount: { paddingHorizontal: 4 },
  row: { gap: 12, padding: Spacing.three },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { alignItems: 'center' },
  pressed: { opacity: 0.7 },
});
