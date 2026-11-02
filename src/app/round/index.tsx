import { Link, router } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DrawNumbers } from '@/components/draw-numbers';
import { NumberPicker } from '@/components/number-picker';
import { Collapsible } from '@/components/ui/collapsible';
import { useTheme } from '@/hooks/use-theme';
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

function Row({ d, highlight }: { d: Draw; highlight?: readonly number[] }) {
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
          <DrawNumbers numbers={d.numbers} bonus={d.bonus} size={30} highlight={highlight} />
        </ThemedView>
      </Pressable>
    </Link>
  );
}

export default function RoundListScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [roundText, setRoundText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<number[]>([]);

  const data = useMemo(
    () => (filter.length ? DRAWS_DESC.filter((d) => filter.every((n) => d.numbers.includes(n) || d.bonus === n)) : DRAWS_DESC),
    [filter],
  );

  const go = () => {
    const n = Number(roundText);
    if (!Number.isInteger(n) || n < 1 || n > LATEST_DRAW.round) {
      setError(`1~${LATEST_DRAW.round} 사이 회차를 넣어 주세요.`);
      return;
    }
    setError(null);
    router.push(`/round/${n}`);
  };
  const toggle = (n: number) =>
    setFilter((f) => (f.includes(n) ? f.filter((x) => x !== n) : f.length >= 6 ? f : [...f, n].sort((a, b) => a - b)));

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(d) => String(d.round)}
        renderItem={({ item }) => <Row d={item} highlight={filter.length ? filter : undefined} />}
        initialNumToRender={20}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="subtitle">회차별 당첨번호</ThemedText>
            <ThemedText themeColor="textSecondary">1회부터 {LATEST_DRAW.round}회까지</ThemedText>
            <View style={styles.search}>
              <TextInput
                value={roundText}
                onChangeText={(v) => setRoundText(v.replace(/\D/g, '').slice(0, 5))}
                onSubmitEditing={go}
                placeholder="회차 번호로 이동"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                returnKeyType="go"
                accessibilityLabel="회차 번호"
                style={[styles.input, { color: theme.text, borderColor: theme.chartGrid }]}
              />
              <Button label="이동" onPress={go} disabled={!roundText} />
            </View>
            {error && (
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            )}
            <Collapsible title={filter.length ? `번호로 찾기: ${filter.join(', ')}` : '번호로 찾기'}>
              <View style={styles.filter}>
                <NumberPicker fixed={filter} excluded={[]} onPress={toggle} />
                <View style={styles.filterFoot}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                    {filter.length
                      ? `고른 번호가 모두 나온 회차 ${data.length}개 (보너스 포함)`
                      : '번호를 고르면 그 번호가 모두 나온 회차만 보여요.'}
                  </ThemedText>
                  {filter.length > 0 && <Button label="초기화" onPress={() => setFilter([])} />}
                </View>
              </View>
            </Collapsible>
          </View>
        }
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary">
            고른 번호가 모두 나온 회차가 없어요.
          </ThemedText>
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
  header: { gap: Spacing.two, marginBottom: Spacing.three },
  search: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  input: { flex: 1, borderWidth: 1.5, borderRadius: Spacing.three, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  filter: { gap: Spacing.two },
  filterFoot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  row: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  pressed: { opacity: 0.7 },
});
