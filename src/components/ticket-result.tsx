import { StyleSheet, View } from 'react-native';

import { LottoBalls } from '@/components/lotto-ball';
import { ThemedText } from '@/components/themed-text';
import { formatKRW } from '@/lib/format';
import { checkTicket, type Rank } from '@/lib/lotto/check';
import type { Draw } from '@/lib/lotto/draws';

export const RANK_COLORS: Record<Rank, string> = {
  1: '#E5484D',
  2: '#F76B15',
  3: '#D99A00',
  4: '#30A46C',
  5: '#208AEF',
};

export function RankBadge({ rank, prize }: { rank: Rank | null; prize?: number }) {
  if (!rank) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        낙첨
      </ThemedText>
    );
  }
  return (
    <ThemedText type="smallBold" style={{ color: RANK_COLORS[rank] }}>
      {rank}등{prize ? ` · ${formatKRW(prize)}` : ''}
    </ThemedText>
  );
}

// A ticket's six numbers. With a draw, matched numbers stay colored, the rest are faded, and a
// bonus match (2nd prize) is outlined.
export function TicketResult({ numbers, draw, size = 32 }: { numbers: readonly number[]; draw?: Draw; size?: number }) {
  if (!draw) {
    return <LottoBalls numbers={numbers} size={size} />;
  }
  const r = checkTicket(numbers, draw);
  return (
    <View style={styles.wrap}>
      <LottoBalls numbers={numbers} size={size} highlight={r.matched} ring={r.bonusMatched ? [draw.bonus] : undefined} />
      <View style={styles.badge}>
        <RankBadge rank={r.rank} prize={r.prize} />
        <ThemedText type="small" themeColor="textSecondary">
          {r.matched.length}개 일치{r.bonusMatched ? ' + 보너스' : ''}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  badge: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
});
