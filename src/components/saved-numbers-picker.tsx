import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LottoBalls } from '@/components/lotto-ball';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useLatestDraw } from '@/hooks/use-latest-draw';
import { useMyTickets, type MyTicket } from '@/hooks/use-my-tickets';
import { useTheme } from '@/hooks/use-theme';

const ROUNDS_SHOWN = 3;
const PER_ROUND = 5;

// Saved tickets grouped by round (newest round first), to fill a number entry with one tap.
export function SavedNumbersPicker({ onPick, verb }: { onPick: (numbers: number[]) => void; verb: string }) {
  const theme = useTheme();
  const { tickets, loaded } = useMyTickets();
  const latestRound = useLatestDraw().round;
  const [showAll, setShowAll] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<number, MyTicket[]>();
    for (const t of tickets) map.set(t.round, [...(map.get(t.round) ?? []), t]);
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [tickets]);
  if (!loaded || groups.length === 0) return null;

  const shown = showAll ? groups : groups.slice(0, ROUNDS_SHOWN);
  return (
    <View style={styles.wrap}>
      <ThemedText type="caption" themeColor="textTertiary">
        저장한 번호에서 고르기
      </ThemedText>
      {shown.map(([round, list]) => (
        <View key={round} style={styles.group}>
          <View style={styles.head}>
            <ThemedText type="smallBold">{round}회</ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              {list.length}장 · {round > latestRound ? '추첨 전' : '추첨 끝남'}
            </ThemedText>
          </View>
          {list.slice(0, PER_ROUND).map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`${round}회 ${t.numbers.join(' ')} ${verb}`}
              onPress={() => onPick([...t.numbers])}
              style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
              <LottoBalls numbers={t.numbers} size={26} />
            </Pressable>
          ))}
          {list.length > PER_ROUND && (
            <ThemedText type="caption" themeColor="textTertiary">
              외 {list.length - PER_ROUND}장
            </ThemedText>
          )}
        </View>
      ))}
      {groups.length > ROUNDS_SHOWN && (
        <Pressable accessibilityRole="button" onPress={() => setShowAll(!showAll)} hitSlop={8}>
          <ThemedText type="caption" style={{ color: theme.primary, fontWeight: '700' }}>
            {showAll ? '접기' : `이전 회차 ${groups.length - ROUNDS_SHOWN}개 더 보기`}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  group: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  row: { borderRadius: Radius.md, padding: 10 },
  pressed: { opacity: 0.7 },
});
