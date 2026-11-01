import * as Clipboard from 'expo-clipboard';
import type { Metadata } from 'expo-router/server';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { LottoBalls } from '@/components/lotto-ball';
import { NumberPicker } from '@/components/number-picker';
import { Page } from '@/components/page';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useLatestDraw } from '@/hooks/use-latest-draw';
import { useTheme } from '@/hooks/use-theme';
import { generate, MAX_FIXED, type GenerateError, type GenerateMode } from '@/lib/lotto/generator';
import { FITTED_THROUGH_ROUND } from '@/lib/lotto/popularity-weights';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const LABELS = 'ABCDEFGHIJ';
const SUM_RANGE = [100, 175] as const; // 79% of all combinations fall in this range

const MODES: { value: GenerateMode; label: string }[] = [
  { value: 'unpopular', label: '남들이 안 고르는 번호' },
  { value: 'random', label: '완전 무작위' },
];
const COUNTS = [
  { value: '1', label: '1세트' },
  { value: '3', label: '3세트' },
  { value: '5', label: '5세트' },
  { value: '10', label: '10세트' },
] as const;
const ODDS = [
  { value: 'any', label: '상관없음' },
  { value: '2', label: '홀2:짝4' },
  { value: '3', label: '홀3:짝3' },
  { value: '4', label: '홀4:짝2' },
] as const;
const SUMS = [
  { value: 'any', label: '상관없음' },
  { value: 'mid', label: `합계 ${SUM_RANGE[0]}~${SUM_RANGE[1]}` },
] as const;
const PICK_MODES = [
  { value: 'fixed', label: '고정수 고르기' },
  { value: 'excluded', label: '제외수 고르기' },
] as const;

type Count = (typeof COUNTS)[number]['value'];
type Odd = (typeof ODDS)[number]['value'];
type Sum = (typeof SUMS)[number]['value'];
type PickMode = (typeof PICK_MODES)[number]['value'];

const ERRORS: Record<GenerateError, string> = {
  tooManyFixed: `고정수는 ${MAX_FIXED}개까지 고를 수 있어요.`,
  notEnoughNumbers: '제외한 번호가 너무 많아서 6개를 채울 수 없어요.',
  oddEvenImpossible: '고정수·제외수 때문에 이 홀짝 조건은 만들 수 없어요.',
  noMatch: '조건에 맞는 조합을 찾지 못했어요. 합계 조건을 풀어 보세요.',
};

export function generateMetadata(): Metadata {
  const title = `로또 번호 생성기 - 고정수·제외수, 남들이 안 고르는 번호 | ${SITE_NAME}`;
  const description =
    '고정수·제외수, 홀짝·합계 조건으로 로또 번호를 뽑아요. 당첨 확률은 같지만 1등 상금을 나눌 사람이 적은 조합도 골라 드려요.';
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/generate` },
    openGraph: { title, description, url: `${SITE_URL}/generate`, siteName: SITE_NAME, type: 'website' },
  };
}

function toggle(list: number[], n: number): number[] {
  return list.includes(n) ? list.filter((x) => x !== n) : [...list, n].sort((a, b) => a - b);
}

function canNativeShare(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export default function GenerateScreen() {
  const hydrated = useHydrated();
  const theme = useTheme();
  const nextRound = useLatestDraw().round + 1;

  const [mode, setMode] = useState<GenerateMode>('unpopular');
  const [count, setCount] = useState<Count>('5');
  const [odd, setOdd] = useState<Odd>('any');
  const [sum, setSum] = useState<Sum>('any');
  const [fixed, setFixed] = useState<number[]>([]);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [pickMode, setPickMode] = useState<PickMode>('fixed');
  const [roll, setRoll] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Random picks must not be part of the static web render, so they are made after hydration.
  // Any change to the options (or 다시 뽑기) draws new sets.
  const result = useMemo(
    () =>
      hydrated
        ? generate({
            mode,
            count: Number(count),
            fixed,
            excluded,
            oddCount: odd === 'any' ? null : Number(odd),
            sumRange: sum === 'mid' ? SUM_RANGE : null,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `roll` forces a new draw
    [hydrated, mode, count, odd, sum, fixed, excluded, roll],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const onPickNumber = (n: number) => {
    if (pickMode === 'fixed') {
      if (!fixed.includes(n) && fixed.length >= MAX_FIXED) {
        setToast(ERRORS.tooManyFixed);
        return;
      }
      setFixed(toggle(fixed, n));
      setExcluded(excluded.filter((x) => x !== n));
    } else {
      setExcluded(toggle(excluded, n));
      setFixed(fixed.filter((x) => x !== n));
    }
  };

  const sets = result?.sets ?? [];
  const shareText = [
    `${SITE_NAME} 번호 · ${nextRound}회`,
    ...sets.map((s, i) => `${LABELS[i]}  ${s.numbers.join(' ')}`),
    `${SITE_URL}/generate`,
  ].join('\n');

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(shareText);
      setToast('번호를 복사했어요.');
    } catch {
      setToast('복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요.');
    }
  };
  const share = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      await copy(); // e.g. a browser without the share sheet
    }
  };

  const conditions = [
    fixed.length > 0 && `고정 ${fixed.join(', ')}`,
    excluded.length > 0 && `제외 ${excluded.length}개`,
    odd !== 'any' && ODDS.find((o) => o.value === odd)?.label,
    sum !== 'any' && `합계 ${SUM_RANGE[0]}~${SUM_RANGE[1]}`,
  ].filter(Boolean);

  return (
    <Page>
      <View style={styles.header}>
        <ThemedText type="subtitle">번호 생성</ThemedText>
        <ThemedText themeColor="textSecondary">{nextRound}회 추첨용 번호 뽑기</ThemedText>
      </View>

      <Segmented options={MODES} value={mode} onChange={setMode} />

      <ThemedView type="backgroundElement" style={styles.notice}>
        <ThemedText type="small">
          {mode === 'unpopular'
            ? '당첨 확률은 모든 조합이 똑같아요 (814만 5,060분의 1). 대신 다른 사람과 겹칠 가능성이 낮은 조합을 골라서, 1등에 당첨되면 상금을 나눌 사람이 적도록 했어요.'
            : '조건만 맞추고 나머지는 완전히 무작위로 뽑아요. 자동 구매와 같은 방식이에요.'}
        </ThemedText>
      </ThemedView>

      <Segmented options={[...COUNTS]} value={count} onChange={setCount} />

      <View style={styles.sets}>
        {result?.error ? (
          <Card>
            <ThemedText type="small">{ERRORS[result.error]}</ThemedText>
          </Card>
        ) : result ? (
          sets.map((s, i) => (
            <ThemedView key={s.numbers.join(',')} type="backgroundElement" style={styles.setCard}>
              <View style={styles.setHeader}>
                <ThemedText type="smallBold">{LABELS[i]}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {s.lessPopularThan >= 50
                    ? `무작위 조합의 ${s.lessPopularThan}%보다 덜 인기`
                    : `무작위 조합의 ${100 - s.lessPopularThan}%보다 인기 많음`}
                </ThemedText>
              </View>
              <LottoBalls numbers={s.numbers} />
            </ThemedView>
          ))
        ) : (
          Array.from({ length: Number(count) }, (_, i) => (
            <ThemedView key={i} type="backgroundElement" style={[styles.setCard, styles.placeholder]} />
          ))
        )}
        {result && !result.error && sets.length < Number(count) && (
          <ThemedText type="small" themeColor="textSecondary">
            조건에 맞는 조합이 {sets.length}개뿐이에요.
          </ThemedText>
        )}
        {result?.patternsRelaxed && (
          <ThemedText type="small" themeColor="textSecondary">
            고정수·제외수 때문에 연속 번호처럼 사람들이 많이 고르는 모양을 다 피하지는 못했어요.
          </ThemedText>
        )}
        {conditions.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            적용한 조건: {conditions.join(' · ')}
          </ThemedText>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRoll((r) => r + 1)}
          style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
          <ThemedText style={styles.primaryText}>다시 뽑기</ThemedText>
        </Pressable>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            disabled={sets.length === 0}
            onPress={copy}
            style={({ pressed }) => [styles.button, styles.secondary, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
            <ThemedText type="smallBold">복사</ThemedText>
          </Pressable>
          {hydrated && canNativeShare() && (
            <Pressable
              accessibilityRole="button"
              disabled={sets.length === 0}
              onPress={share}
              style={({ pressed }) => [styles.button, styles.secondary, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
              <ThemedText type="smallBold">공유</ThemedText>
            </Pressable>
          )}
        </View>
        {toast && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.toast} accessibilityLiveRegion="polite">
            {toast}
          </ThemedText>
        )}
      </View>

      <Card>
        <ThemedText type="smallBold">조건</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          조건은 당첨 확률을 바꾸지 않아요. 원하는 모양의 번호를 받고 싶을 때 쓰세요.
        </ThemedText>

        <ThemedText type="small" style={styles.label}>홀짝</ThemedText>
        <Segmented options={[...ODDS]} value={odd} onChange={setOdd} />

        <ThemedText type="small" style={styles.label}>번호 합계</ThemedText>
        <Segmented options={[...SUMS]} value={sum} onChange={setSum} />
        <ThemedText type="small" themeColor="textSecondary">
          전체 조합의 79%가 합계 {SUM_RANGE[0]}~{SUM_RANGE[1]} 사이예요. 당첨번호도 그래서 이 구간에 많이 나와요.
        </ThemedText>

        <View style={styles.pickHeader}>
          <ThemedText type="small" style={styles.label}>
            고정수 {fixed.length}/{MAX_FIXED} · 제외수 {excluded.length}
          </ThemedText>
          {(fixed.length > 0 || excluded.length > 0) && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFixed([]);
                setExcluded([]);
              }}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.reset}>
                초기화
              </ThemedText>
            </Pressable>
          )}
        </View>
        <Segmented options={[...PICK_MODES]} value={pickMode} onChange={setPickMode} />
        <NumberPicker fixed={fixed} excluded={excluded} onPress={onPickNumber} />
        <ThemedText type="small" themeColor="textSecondary">
          {pickMode === 'fixed' ? '누른 번호는 모든 세트에 들어가요.' : '누른 번호는 어느 세트에도 나오지 않아요.'}
        </ThemedText>
      </Card>

      <Collapsible title="'남들이 안 고르는 번호'는 어떻게 골랐나요?">
        <View style={styles.explain}>
          <ThemedText type="small">
            추첨은 완전한 무작위라서, 판매량만 알면 1등이 몇 명 나와야 하는지 계산할 수 있어요. 실제 1등이 그보다
            많았던 회차는 많은 사람이 고른 조합이에요.
          </ThemedText>
          <ThemedText type="small">
            역대 {FITTED_THROUGH_ROUND.toLocaleString('ko-KR')}회의 당첨자 수를 분석해 번호별 인기도를 추정했어요. 7, 9,
            10~12처럼 행운의 숫자나 날짜에 쓰이는 번호는 인기가 많고, 41~45 같은 큰 번호는 인기가 적었어요.
          </ThemedText>
          <ThemedText type="small">
            검증: 분석에 쓰지 않은 회차에서, 인기도가 낮게 예측된 조합은 1등 당첨자가 기대값의 0.95배, 높게 예측된
            조합은 1.08배였어요.
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
  actions: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  button: { paddingVertical: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  primary: { backgroundColor: '#208AEF' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { flex: 1 },
  pressed: { opacity: 0.8 },
  toast: { textAlign: 'center' },
  label: { marginTop: Spacing.two, fontWeight: '700' },
  pickHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  reset: { textDecorationLine: 'underline' },
  explain: { gap: Spacing.two },
});
