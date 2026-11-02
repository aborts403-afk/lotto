import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Notice, Section } from '@/components/card';
import { Chips } from '@/components/chips';
import { LottoBalls } from '@/components/lotto-ball';
import { NumberPicker } from '@/components/number-picker';
import { Page } from '@/components/page';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Collapsible } from '@/components/ui/collapsible';
import { Radius, Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useAllDraws, useLatestDraw } from '@/hooks/use-latest-draw';
import { addTickets } from '@/hooks/use-my-tickets';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import type { Draw } from '@/lib/lotto/draws';
import {
  BALANCED_SUM,
  generate,
  hashSeed,
  isBalanced,
  MAX_FIXED,
  randomCombo,
  seededRng,
  type GenerateError,
  type GenerateMode,
} from '@/lib/lotto/generator';
import { FITTED_THROUGH_ROUND } from '@/lib/lotto/popularity-weights';
import { coldWeights, HOT_WINDOW, hotWeights, numberStats, topBy } from '@/lib/lotto/stats';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const LABELS = 'ABCDEFGHIJ';
const SUM_RANGE = [100, 175] as const; // 79% of all combinations fall in this range
const POOL_MAX = 20;

const MODES: { value: GenerateMode; label: string; title: string }[] = [
  { value: 'unpopular', label: '안 겹치는 번호', title: '남들이 안 고르는 번호' },
  { value: 'random', label: '완전 무작위', title: '완전 무작위' },
  { value: 'balanced', label: '당첨번호 닮은꼴', title: '당첨번호 닮은꼴' },
  { value: 'hot', label: '많이 나온 번호', title: '많이 나온 번호 위주' },
  { value: 'cold', label: '안 나온 번호', title: '오래 안 나온 번호 위주' },
  { value: 'wheel', label: '내 후보로 조합', title: '내 후보 번호로 조합' },
  { value: 'phrase', label: '문구로 뽑기', title: '문구로 뽑기' },
];
const COUNTS = [
  { value: '1', label: '1세트' },
  { value: '3', label: '3세트' },
  { value: '5', label: '5세트' },
  { value: '10', label: '10세트' },
] as const;
const ODDS = [
  { value: 'any', label: '상관없음' },
  { value: '2', label: '홀2 짝4' },
  { value: '3', label: '홀3 짝3' },
  { value: '4', label: '홀4 짝2' },
] as const;
const SUMS = [
  { value: 'any', label: '상관없음' },
  { value: 'mid', label: `${SUM_RANGE[0]}~${SUM_RANGE[1]}` },
] as const;
const PICK_MODES = [
  { value: 'fixed', label: '꼭 넣을 번호' },
  { value: 'excluded', label: '뺄 번호' },
] as const;

type Count = (typeof COUNTS)[number]['value'];
type Odd = (typeof ODDS)[number]['value'];
type Sum = (typeof SUMS)[number]['value'];
type PickMode = (typeof PICK_MODES)[number]['value'];

const ERRORS: Record<GenerateError, string> = {
  tooManyFixed: `꼭 넣을 번호는 ${MAX_FIXED}개까지 고를 수 있어요.`,
  notEnoughNumbers: '뺀 번호가 너무 많아서 6개를 채울 수 없어요.',
  oddEvenImpossible: '고른 번호 때문에 이 홀짝 조건은 만들 수 없어요.',
  noMatch: '조건에 맞는 조합을 찾지 못했어요. 합계 조건을 풀어 보세요.',
  poolTooSmall: '후보 번호를 6개 이상 골라 주세요.',
};

function comb(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

// Share of all combinations that have the "당첨번호 닮은꼴" shape (fixed sample, same on every render).
let balancedShareCache: number | null = null;
function balancedShareOfAll(): number {
  if (balancedShareCache === null) {
    const rng = seededRng(2024);
    let hit = 0;
    for (let i = 0; i < 20000; i++) if (isBalanced(randomCombo(rng))) hit++;
    balancedShareCache = hit / 20000;
  }
  return balancedShareCache;
}

export function generateMetadata(): Metadata {
  const title = `로또 번호 생성기 - 남들이 안 고르는 번호, 통계·조합·문구로 뽑기 | ${SITE_NAME}`;
  const description =
    '남들이 안 고르는 번호, 완전 무작위, 당첨번호 닮은꼴, 많이 나온/오래 안 나온 번호, 내 후보 조합, 문구로 뽑기. 고정수·제외수, 홀짝·합계 조건도 넣을 수 있어요.';
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

function modeDescription(mode: GenerateMode, draws: readonly Draw[]): string {
  const odds = '당첨 확률은 어떤 방식이든 똑같아요.';
  switch (mode) {
    case 'unpopular':
      return `다른 사람과 겹칠 가능성이 낮은 조합을 골라요. 1등이 되면 상금을 나눌 사람이 적어요. ${odds}`;
    case 'random':
      return '조건만 맞추고 나머지는 완전히 무작위로 뽑아요. 자동 구매와 같은 방식이에요.';
    case 'balanced': {
      const past = draws.filter((d) => isBalanced(d.numbers)).length / draws.length;
      return `홀짝·큰 번호 2~4개, 합계 ${BALANCED_SUM[0]}~${BALANCED_SUM[1]}, 연속 번호 한 쌍 이하인 조합만 뽑아요. 역대 당첨번호의 ${Math.round(past * 100)}%가 이 모양이에요 (전체 조합 중에서도 ${Math.round(balancedShareOfAll() * 100)}%). ${odds}`;
    }
    case 'hot': {
      const top = topBy(numberStats(draws.slice(0, HOT_WINDOW)), (s) => s.count, 5).map((s) => s.n);
      return `최근 ${HOT_WINDOW}회에 자주 나온 번호(${top.join(', ')} 등)가 더 잘 뽑혀요. 지난 결과는 다음 추첨에 영향을 주지 않아요.`;
    }
    case 'cold': {
      const top = topBy(numberStats(draws), (s) => s.drawsSince ?? 0, 5).map((s) => s.n);
      return `오래 안 나온 번호(${top.join(', ')} 등)가 더 잘 뽑혀요. 번호가 "나올 때가 된" 건 아니에요.`;
    }
    case 'wheel':
      return '마음에 드는 번호를 7개 이상 고르면, 그 번호들로만 여러 세트를 만들어요.';
    case 'phrase':
      return '이름, 생일, 꿈… 같은 문구는 이번 회차 동안 늘 같은 번호가 나와요. 재미로 쓰세요.';
  }
}

function SetRow({ index, numbers, note, last }: { index: number; numbers: readonly number[]; note?: string; last: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.setRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
      <View style={[styles.setLabel, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.bold}>
          {LABELS[index]}
        </ThemedText>
      </View>
      <View style={styles.flex}>
        <LottoBalls numbers={numbers} size={34} />
        {note && (
          <ThemedText type="caption" themeColor="textTertiary">
            {note}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

export default function GenerateScreen() {
  const hydrated = useHydrated();
  const theme = useTheme();
  const nextRound = useLatestDraw().round + 1;
  const draws = useAllDraws();

  const [mode, setMode] = useState<GenerateMode>('unpopular');
  const [count, setCount] = useState<Count>('5');
  const [odd, setOdd] = useState<Odd>('any');
  const [sum, setSum] = useState<Sum>('any');
  const [fixed, setFixed] = useState<number[]>([]);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [pickMode, setPickMode] = useState<PickMode>('fixed');
  const [pool, setPool] = useState<number[]>([]);
  const [phrase, setPhrase] = useState('');
  const [roll, setRoll] = useState(0);
  const [toast, setToast] = useToast();
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const weights = useMemo(
    () => (mode === 'hot' ? hotWeights(draws) : mode === 'cold' ? coldWeights(draws) : null),
    [mode, draws],
  );
  const description = useMemo(() => modeDescription(mode, draws), [mode, draws]);
  const phraseKey = phrase.trim();
  const isWheel = mode === 'wheel';

  // Random picks must not be part of the static web render, so they are made after hydration.
  // Any change to the options (or 다시 뽑기) draws new sets. The phrase mode is seeded instead:
  // the same phrase gives the same numbers for this week's round.
  const result = useMemo(
    () => {
      if (!hydrated || (mode === 'phrase' && !phraseKey)) return null;
      const rng = mode === 'phrase' ? seededRng(hashSeed(`${phraseKey}|${nextRound}`)) : Math.random;
      return generate(
        {
          mode,
          count: Number(count),
          fixed: isWheel ? [] : fixed,
          excluded: isWheel ? [] : excluded,
          oddCount: odd === 'any' ? null : Number(odd),
          sumRange: sum === 'mid' ? SUM_RANGE : null,
          weights,
          pool: isWheel ? pool : null,
        },
        rng,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `roll` forces a new draw
    [hydrated, mode, count, odd, sum, fixed, excluded, pool, phraseKey, nextRound, weights, roll],
  );

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
  const onPickPool = (n: number) => {
    if (!pool.includes(n) && pool.length >= POOL_MAX) {
      setToast(`후보는 ${POOL_MAX}개까지 고를 수 있어요.`);
      return;
    }
    setPool(toggle(pool, n));
  };

  const sets = result?.sets ?? [];
  const resultKey = `${nextRound}:${sets.map((x) => x.numbers.join(',')).join('|')}`;
  const saved = savedKey === resultKey;
  const shareText = [
    `${SITE_NAME} 번호 · ${nextRound}회`,
    ...sets.map((s, i) => `${LABELS[i]}  ${s.numbers.join(' ')}`),
    `${SITE_URL}/generate`,
  ].join('\n');

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(shareText);
      setToast('번호를 복사했어요');
    } catch {
      setToast('복사하지 못했어요. 클립보드 권한을 확인해 주세요');
    }
  };
  const save = async () => {
    const added = await addTickets(
      nextRound,
      sets.map((x) => x.numbers),
      'generate',
    );
    setSavedKey(resultKey);
    setToast(added ? `${added}세트를 내 번호에 저장했어요` : '이미 저장한 번호예요');
  };
  const share = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      await copy(); // e.g. a browser without the share sheet
    }
  };

  const conditionCount =
    (odd !== 'any' ? 1 : 0) + (sum !== 'any' ? 1 : 0) + (!isWheel && (fixed.length || excluded.length) ? 1 : 0);
  const conditionSummary = [
    !isWheel && fixed.length > 0 && `포함 ${fixed.join(', ')}`,
    !isWheel && excluded.length > 0 && `제외 ${excluded.length}개`,
    odd !== 'any' && ODDS.find((o) => o.value === odd)?.label,
    sum !== 'any' && `합계 ${SUM_RANGE[0]}~${SUM_RANGE[1]}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const waitingInput = hydrated && ((mode === 'phrase' && !phraseKey) || (isWheel && pool.length < 6));

  return (
    <Page title="번호 생성" subtitle={`${nextRound}회 추첨용`} toast={toast}>
      <View style={styles.block}>
        <Chips options={MODES.map((m) => ({ value: m.value, label: m.label }))} value={mode} onChange={setMode} scroll />
        <Notice>{description}</Notice>
      </View>

      {mode === 'phrase' && (
        <TextInput
          value={phrase}
          onChangeText={setPhrase}
          placeholder="이름, 생일, 어젯밤 꿈… 아무 문구나"
          placeholderTextColor={theme.textTertiary}
          maxLength={60}
          accessibilityLabel="문구"
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
      )}

      {isWheel && (
        <Card>
          <View style={styles.between}>
            <ThemedText type="heading">
              후보 번호{' '}
              <ThemedText type="heading" style={{ color: theme.primary }}>
                {pool.length}
              </ThemedText>
              <ThemedText type="small" themeColor="textTertiary">
                {' '}
                / {POOL_MAX}
              </ThemedText>
            </ThemedText>
            {pool.length > 0 && <Button label="초기화" size="sm" variant="ghost" onPress={() => setPool([])} />}
          </View>
          <NumberPicker fixed={pool} onPress={onPickPool} />
          {pool.length >= 6 && (
            <ThemedText type="caption" themeColor="textTertiary">
              고른 {pool.length}개로 만들 수 있는 조합은 {comb(pool.length, 6).toLocaleString('ko-KR')}가지예요.
            </ThemedText>
          )}
        </Card>
      )}

      <Card>
        <View style={styles.between}>
          <ThemedText type="heading">{MODES.find((m) => m.value === mode)?.title}</ThemedText>
        </View>
        <Segmented options={[...COUNTS]} value={count} onChange={setCount} />

        {result?.error ? (
          <View style={[styles.empty, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {ERRORS[result.error]}
            </ThemedText>
          </View>
        ) : waitingInput ? (
          <View style={[styles.empty, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {mode === 'phrase' ? '위에 문구를 넣으면 번호가 나와요' : `후보 번호를 ${6 - pool.length}개 더 고르세요`}
            </ThemedText>
          </View>
        ) : result ? (
          <View>
            {sets.map((s, i) => (
              <SetRow
                key={s.numbers.join(',')}
                index={i}
                numbers={s.numbers}
                last={i === sets.length - 1}
                note={mode === 'unpopular' ? `무작위 조합의 ${s.lessPopularThan}%보다 덜 고르는 조합` : undefined}
              />
            ))}
          </View>
        ) : (
          <View style={styles.placeholderList}>
            {Array.from({ length: Number(count) }, (_, i) => (
              <View key={i} style={[styles.placeholder, { backgroundColor: theme.backgroundSelected }]} />
            ))}
          </View>
        )}
        {result && !result.error && sets.length > 0 && sets.length < Number(count) && (
          <ThemedText type="caption" themeColor="textTertiary">
            조건에 맞는 조합이 {sets.length}개뿐이에요.
          </ThemedText>
        )}
        {result?.patternsRelaxed && (
          <ThemedText type="caption" themeColor="textTertiary">
            고른 번호 때문에 연속 번호처럼 사람들이 많이 고르는 모양을 다 피하지는 못했어요.
          </ThemedText>
        )}

        <View style={styles.actions}>
          {mode !== 'phrase' && (
            <Button
              label="다시 뽑기"
              icon="refresh"
              variant="primary"
              size="lg"
              onPress={() => setRoll((r) => r + 1)}
              disabled={!!waitingInput}
            />
          )}
          <View style={styles.row}>
            <Button
              label={saved ? '저장됨' : '내 번호에 저장'}
              icon={saved ? 'check' : 'bookmark'}
              variant="tonal"
              onPress={saved ? () => router.push('/my') : save}
              disabled={sets.length === 0}
              style={styles.flex}
            />
            <Button icon="copy" accessibilityLabel="복사" onPress={copy} disabled={sets.length === 0} />
            {hydrated && canNativeShare() && (
              <Button icon="share" accessibilityLabel="공유" onPress={share} disabled={sets.length === 0} />
            )}
          </View>
        </View>
      </Card>

      <Card>
        <Collapsible
          title={
            conditionCount
              ? `세부 조건 ${conditionCount}개 적용 중 · ${conditionSummary}`
              : '세부 조건 (홀짝, 합계, 포함·제외 번호)'
          }>
          <View style={styles.conditions}>
            <ThemedText type="caption" themeColor="textTertiary">
              조건은 당첨 확률을 바꾸지 않아요. 원하는 모양의 번호를 받고 싶을 때 쓰세요.
            </ThemedText>
            <View style={styles.field}>
              <ThemedText type="smallBold">홀짝</ThemedText>
              <Segmented options={[...ODDS]} value={odd} onChange={setOdd} />
            </View>
            <View style={styles.field}>
              <ThemedText type="smallBold">번호 합계</ThemedText>
              <Segmented options={[...SUMS]} value={sum} onChange={setSum} />
              <ThemedText type="caption" themeColor="textTertiary">
                전체 조합의 79%가 합계 {SUM_RANGE[0]}~{SUM_RANGE[1]} 사이예요.
              </ThemedText>
            </View>
            {!isWheel && (
              <View style={styles.field}>
                <View style={styles.between}>
                  <ThemedText type="smallBold">
                    포함 {fixed.length}/{MAX_FIXED} · 제외 {excluded.length}
                  </ThemedText>
                  {(fixed.length > 0 || excluded.length > 0) && (
                    <Button
                      label="초기화"
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        setFixed([]);
                        setExcluded([]);
                      }}
                    />
                  )}
                </View>
                <Segmented options={[...PICK_MODES]} value={pickMode} onChange={setPickMode} />
                <NumberPicker fixed={fixed} excluded={excluded} onPress={onPickNumber} />
                <ThemedText type="caption" themeColor="textTertiary">
                  {pickMode === 'fixed' ? '누른 번호는 모든 세트에 들어가요.' : '누른 번호는 어느 세트에도 나오지 않아요.'}
                </ThemedText>
              </View>
            )}
          </View>
        </Collapsible>
      </Card>

      <Section title="알아 두세요">
        <Card>
          <Collapsible title="'남들이 안 고르는 번호'는 어떻게 골랐나요?">
            <View style={styles.explain}>
              <ThemedText type="small" themeColor="textSecondary">
                추첨은 완전한 무작위라서, 판매량만 알면 1등이 몇 명 나와야 하는지 계산할 수 있어요. 실제 1등이 그보다 많았던
                회차는 많은 사람이 고른 조합이에요.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                역대 {FITTED_THROUGH_ROUND.toLocaleString('ko-KR')}회의 당첨자 수로 번호별 인기도를 추정했어요. 7, 9, 10~12처럼
                행운의 숫자나 날짜에 쓰이는 번호는 인기가 많고, 41~45 같은 큰 번호는 인기가 적었어요.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                검증: 분석에 쓰지 않은 회차에서, 인기도가 낮게 예측된 조합은 1등 당첨자가 기대값의 0.95배, 높게 예측된 조합은
                1.08배였어요.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                연속 번호, 용지의 한 줄, 같은 끝자리, 모두 31 이하인 조합처럼 사람들이 일부러 고르는 모양은 뺐어요. 모두가 같은
                번호를 받지 않도록, 인기 없는 조합들 중에서 무작위로 뽑아요.
              </ThemedText>
            </View>
          </Collapsible>
        </Card>
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1, gap: 4 },
  bold: { fontWeight: '800' },
  center: { textAlign: 'center' },
  input: { borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 14, fontSize: 16 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  setLabel: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  empty: { borderRadius: Radius.md, paddingVertical: Spacing.five, paddingHorizontal: Spacing.three },
  placeholderList: { gap: 10 },
  placeholder: { height: 46, borderRadius: Radius.md },
  actions: { gap: Spacing.two },
  conditions: { gap: Spacing.four },
  field: { gap: 10 },
  explain: { gap: Spacing.two },
});
