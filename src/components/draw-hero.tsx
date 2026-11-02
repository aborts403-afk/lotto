import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LottoBall } from '@/components/lotto-ball';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatDateDots, formatKRW } from '@/lib/format';
import type { Draw } from '@/lib/lotto/draws';

// Deep blue so white text passes contrast (4.5:1+) in light and dark mode.
export const HERO_BLUE = '#1B64DA';
const WHITE_SOFT = 'rgba(255,255,255,0.82)';
const GAP = 6;
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Action = { label: string; onPress: () => void };

// The draw's numbers and 1st prize on a blue card: the main result surface (home, round page).
export function DrawHero({
  draw,
  title,
  primary,
  secondary,
}: {
  draw: Draw;
  title?: string;
  primary?: Action;
  secondary?: Action;
}) {
  const [width, setWidth] = useState(0);
  // 7 balls, the "+" (half a ball) and 7 gaps across the card's inner width.
  const ball = width ? Math.min(42, Math.floor((width - GAP * 7) / 7.5)) : 38;
  const first = draw.ranks[0];
  const picks = draw.firstPrizePickTypes;
  const pickText =
    picks && first.winners > 0
      ? [picks.auto && `자동 ${picks.auto}`, picks.manual && `수동 ${picks.manual}`, picks.semiAuto && `반자동 ${picks.semiAuto}`]
          .filter(Boolean)
          .join(' · ')
      : null;
  const day = DAYS[new Date(`${draw.drawDate}T12:00:00+09:00`).getUTCDay()];

  return (
    <View style={styles.card}>
      <View style={styles.between}>
        <ThemedText type="smallBold" style={styles.white}>
          {title ?? `${draw.round}회 당첨번호`}
        </ThemedText>
        <View style={styles.datePill}>
          <ThemedText type="caption" style={[styles.white, styles.bold]}>
            {formatDateDots(draw.drawDate).slice(5)} {day}요일
          </ThemedText>
        </View>
      </View>

      <View style={styles.balls} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {draw.numbers.map((n) => (
          <LottoBall key={n} n={n} size={ball} outline="rgba(255,255,255,0.9)" />
        ))}
        <ThemedText style={[styles.plus, { width: ball * 0.5, fontSize: ball * 0.45 }]}>+</ThemedText>
        <LottoBall n={draw.bonus} size={ball} outline="rgba(255,255,255,0.9)" />
      </View>

      <View style={styles.divider} />

      <View style={[styles.between, styles.alignEnd]}>
        <View style={styles.gap2}>
          <ThemedText type="caption" style={{ color: WHITE_SOFT }}>
            1등 1인당
          </ThemedText>
          <ThemedText style={[styles.white, styles.amount]}>
            {first.winners > 0 ? formatKRW(first.prize) : '당첨자 없음'}
          </ThemedText>
        </View>
        <View style={[styles.gap2, styles.right]}>
          <ThemedText style={[styles.white, styles.count]}>{first.winners}명</ThemedText>
          {pickText && (
            <ThemedText type="caption" style={{ color: WHITE_SOFT }}>
              {pickText}
            </ThemedText>
          )}
        </View>
      </View>

      {(primary || secondary) && (
        <View style={styles.actions}>
          {primary && (
            <Pressable
              accessibilityRole="button"
              onPress={primary.onPress}
              style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
              <ThemedText style={[styles.buttonText, { color: HERO_BLUE }]}>{primary.label}</ThemedText>
            </Pressable>
          )}
          {secondary && (
            <Pressable
              accessibilityRole="button"
              onPress={secondary.onPress}
              style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
              <ThemedText style={[styles.buttonText, styles.white]}>{secondary.label}</ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: HERO_BLUE, borderRadius: Radius.lg + 4, padding: 20, paddingTop: 22, gap: Spacing.three },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  alignEnd: { alignItems: 'flex-end' },
  white: { color: '#FFFFFF' },
  bold: { fontWeight: '700' },
  datePill: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  balls: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  plus: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.3)' },
  gap2: { gap: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 26, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 },
  count: { fontSize: 17, lineHeight: 24, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  button: { flex: 1, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#FFFFFF' },
  secondary: { backgroundColor: 'rgba(255,255,255,0.16)' },
  buttonText: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
