import { useMemo, useState } from 'react';
import type { Metadata } from 'expo-router/server';
import { Pressable, StyleSheet, View } from 'react-native';

import { LottoBalls } from '@/components/lotto-ball';
import { ThemedText } from '@/components/themed-text';
import { Page } from '@/components/page';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { generateUnpopular, type GeneratedCombo } from '@/lib/lotto/generator';
import { FITTED_THROUGH_ROUND } from '@/lib/lotto/popularity-weights';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const LABELS = ['A', 'B', 'C', 'D', 'E'];

export function generateMetadata(): Metadata {
  const title = `남들이 안 고르는 로또 번호 생성기 | ${SITE_NAME}`;
  const description = '당첨 확률은 같지만 1등 상금을 나눌 사람이 적은 번호. 역대 당첨자 수 데이터로 인기 없는 조합을 골라 드려요.';
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/generate` },
    openGraph: { title, description, url: `${SITE_URL}/generate`, siteName: SITE_NAME, type: 'website' },
  };
}

export default function GenerateScreen() {
  const hydrated = useHydrated();
  // Random picks must not be part of the static web render, so the first set is made after hydration.
  const initial = useMemo(() => (hydrated ? generateUnpopular(5) : null), [hydrated]);
  const [regenerated, setRegenerated] = useState<GeneratedCombo[] | null>(null);
  const sets = regenerated ?? initial;

  return (
    <Page>
          <View style={styles.header}>
            <ThemedText type="subtitle">번호 생성</ThemedText>
            <ThemedText themeColor="textSecondary">남들이 잘 고르지 않는 번호 조합</ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.notice}>
            <ThemedText type="small">
              당첨 확률은 모든 조합이 똑같아요 (814만 5,060분의 1). 대신 다른 사람과 겹칠 가능성이 낮은 조합을
              골라서, 1등에 당첨되면 상금을 나눌 사람이 적도록 했어요.
            </ThemedText>
          </ThemedView>

          <View style={styles.sets}>
            {sets
              ? sets.map((s, i) => (
                  <ThemedView key={s.numbers.join(',')} type="backgroundElement" style={styles.setCard}>
                    <View style={styles.setHeader}>
                      <ThemedText type="smallBold">{LABELS[i]}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        무작위 조합의 {s.lessPopularThan}%보다 덜 인기
                      </ThemedText>
                    </View>
                    <LottoBalls numbers={s.numbers} />
                  </ThemedView>
                ))
              : LABELS.map((l) => (
                  <ThemedView key={l} type="backgroundElement" style={[styles.setCard, styles.placeholder]} />
                ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setRegenerated(generateUnpopular(5))}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <ThemedText style={styles.buttonText}>다시 뽑기</ThemedText>
          </Pressable>

          <Collapsible title="어떻게 골랐나요?">
            <View style={styles.explain}>
              <ThemedText type="small">
                추첨은 완전한 무작위라서, 판매량만 알면 1등이 몇 명 나와야 하는지 계산할 수 있어요. 실제 1등이 그보다
                많았던 회차는 많은 사람이 고른 조합이에요.
              </ThemedText>
              <ThemedText type="small">
                역대 {FITTED_THROUGH_ROUND.toLocaleString('ko-KR')}회의 당첨자 수를 분석해 번호별 인기도를 추정했어요. 7, 9, 10~12처럼 행운의 숫자나 날짜에
                쓰이는 번호는 인기가 많고, 41~45 같은 큰 번호는 인기가 적었어요.
              </ThemedText>
              <ThemedText type="small">
                검증: 분석에 쓰지 않은 회차에서, 인기도가 낮게 예측된 조합은 1등 당첨자가 기대값의 0.95배, 높게
                예측된 조합은 1.08배였어요.
              </ThemedText>
              <ThemedText type="small">
                연속 번호, 용지의 한 줄, 같은 끝자리, 모두 31 이하인 조합처럼 사람들이 일부러 고르는 모양은 제외했어요.
                그리고 모두가 같은 번호를 받지 않도록, 인기 없는 조합들 중에서 무작위로 뽑아요.
              </ThemedText>
            </View>
          </Collapsible>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  notice: { padding: Spacing.three, borderRadius: Spacing.three },
  sets: { gap: Spacing.two },
  setCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  setHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placeholder: { height: 84 },
  button: {
    backgroundColor: '#208AEF',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  explain: { gap: Spacing.two },
});
