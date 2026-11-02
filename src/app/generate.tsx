import * as Clipboard from 'expo-clipboard';
import { Link } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

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
import { useAllDraws, useLatestDraw } from '@/hooks/use-latest-draw';
import { addTickets } from '@/hooks/use-my-tickets';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
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
import type { Draw } from '@/lib/lotto/draws';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const LABELS = 'ABCDEFGHIJ';
const SUM_RANGE = [100, 175] as const; // 79% of all combinations fall in this range

const MODES: { value: GenerateMode; label: string; desc: string }[] = [
  { value: 'unpopular', label: '남들이 안 고르는 번호', desc: '1등 상금을 나눌 사람이 적게' },
  { value: 'random', label: '완전 무작위', desc: '자동 구매와 같은 방식' },
  { value: 'balanced', label: '당첨번호 닮은꼴', desc: '역대 당첨번호에 흔한 모양' },
  { value: 'hot', label: '많이 나온 번호 위주', desc: `최근 ${HOT_WINDOW}회 기준` },
  { value: 'cold', label: '오래 안 나온 번호 위주', desc: '한동안 안 나온 번호' },
  { value: 'wheel', label: '내 후보로 조합', desc: '고른 번호로만 세트 만들기' },
  { value: 'phrase', label: '문구로 뽑기', desc: '이름·생일·꿈으로 이번 주 번호' },
];
const POOL_MAX = 20;
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

function ModeGrid({ value, onChange }: { value: GenerateMode; onChange: (m: GenerateMode) => void }) {
  return (
    <View style={styles.modeGrid}>
      {MODES.map((m) => {
        const selected = m.value === value;
        return (
          <Pressable
            key={m.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(m.value)}
            style={({ pressed }) => [styles.modeItem, pressed && styles.pressed]}>
            <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={[styles.modeCard, selected && styles.modeSelected]}>
              <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'}>
                {m.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.modeDesc}>
                {m.desc}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

function canNativeShare(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

function ModeNotice({ mode, draws }: { mode: GenerateMode; draws: readonly Draw[] }) {
  const balancedPast = useMemo(() => {
    if (mode !== 'balanced') return 0;
    return draws.filter((d) => isBalanced(d.numbers)).length / draws.length;
  }, [mode, draws]);
  const top = useMemo(() => {
    if (mode === 'hot') return topBy(numberStats(draws.slice(0, HOT_WINDOW)), (s) => s.count, 6).map((s) => `${s.n}(${s.count}회)`);
    if (mode === 'cold') return topBy(numberStats(draws), (s) => s.drawsSince ?? 0, 6).map((s) => `${s.n}(${s.drawsSince}회째)`);
    return [];
  }, [mode, draws]);
  const odds = '당첨 확률은 어떤 방식이든 똑같아요 (814만 5,060분의 1).';
  const text: Record<GenerateMode, string> = {
    unpopular: `${odds} 대신 다른 사람과 겹칠 가능성이 낮은 조합을 골라서, 1등에 당첨되면 상금을 나눌 사람이 적도록 했어요.`,
    random: '조건만 맞추고 나머지는 완전히 무작위로 뽑아요. 자동 구매와 같은 방식이에요.',
    balanced: `홀짝 2~4개, 큰 번호(23~45) 2~4개, 합계 ${BALANCED_SUM[0]}~${BALANCED_SUM[1]}, 연속 번호 한 쌍 이하, 번호대 세 곳 이상인 조합만 뽑아요. 역대 당첨번호의 ${Math.round(balancedPast * 100)}%가 이 모양인데, 전체 조합의 ${Math.round(balancedShareOfAll() * 100)}%가 원래 이 모양이라서 그래요. ${odds}`,
    hot: `최근 ${HOT_WINDOW}회에 자주 나온 번호가 더 잘 뽑히도록 했어요. 지금 가장 많이 나온 번호: ${top.join(', ')}. 지난 결과는 다음 추첨에 영향을 주지 않아요. ${odds}`,
    cold: `오래 안 나온 번호일수록 더 잘 뽑히도록 했어요. 지금 가장 오래 안 나온 번호: ${top.join(', ')}. 번호가 "나올 때가 된" 것은 아니에요. ${odds}`,
    wheel: '고른 후보 번호로만 세트를 만들어요. 후보 중 6개가 당첨번호면, 그 조합을 산 경우에만 1등이에요. 후보가 적을수록 같은 번호가 여러 세트에 겹쳐요.',
    phrase: `문구와 회차로 번호를 정해요. 같은 문구는 이번 회차 동안 늘 같은 번호가 나오고, 다음 회차에는 바뀌어요. 재미로 쓰세요. ${odds}`,
  };
  return <ThemedText type="small">{text[mode]}</ThemedText>;
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
  const [savedRoll, setSavedRoll] = useState<number | null>(null);

  const weights = useMemo(
    () => (mode === 'hot' ? hotWeights(draws) : mode === 'cold' ? coldWeights(draws) : null),
    [mode, draws],
  );
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
    if (isWheel) {
      if (!pool.includes(n) && pool.length >= POOL_MAX) {
        setToast(`후보는 ${POOL_MAX}개까지 고를 수 있어요.`);
        return;
      }
      setPool(toggle(pool, n));
      return;
    }
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
  const resultKey = sets.map((x) => x.numbers.join(',')).join('|');
  const saved = savedRoll !== null && savedRoll === hashSeed(resultKey);
  const save = async () => {
    const added = await addTickets(nextRound, sets.map((x) => x.numbers), 'generate');
    setSavedRoll(hashSeed(resultKey));
    setToast(added ? `${added}세트를 ${nextRound}회 번호로 저장했어요.` : '이미 저장한 번호예요.');
  };
  const share = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      await copy(); // e.g. a browser without the share sheet
    }
  };

  const conditions = [
    isWheel && pool.length > 0 && `후보 ${pool.length}개`,
    !isWheel && fixed.length > 0 && `고정 ${fixed.join(', ')}`,
    !isWheel && excluded.length > 0 && `제외 ${excluded.length}개`,
    odd !== 'any' && ODDS.find((o) => o.value === odd)?.label,
    sum !== 'any' && `합계 ${SUM_RANGE[0]}~${SUM_RANGE[1]}`,
  ].filter(Boolean);

  return (
    <Page>
      <View style={styles.header}>
        <ThemedText type="subtitle">번호 생성</ThemedText>
        <ThemedText themeColor="textSecondary">{nextRound}회 추첨용 번호 뽑기</ThemedText>
      </View>

      <ModeGrid value={mode} onChange={setMode} />

      <ThemedView type="backgroundElement" style={styles.notice}>
        <ModeNotice mode={mode} draws={draws} />
      </ThemedView>

      {mode === 'phrase' && (
        <TextInput
          value={phrase}
          onChangeText={setPhrase}
          placeholder="이름, 생일, 어젯밤 꿈… 아무 문구나"
          placeholderTextColor={theme.textSecondary}
          maxLength={60}
          accessibilityLabel="문구"
          style={[styles.input, { color: theme.text, borderColor: theme.chartGrid }]}
        />
      )}
      {isWheel && (
        <Card>
          <View style={styles.pickHeader}>
            <ThemedText type="smallBold">
              후보 번호 {pool.length}/{POOL_MAX}
            </ThemedText>
            {pool.length > 0 && (
              <Pressable accessibilityRole="button" onPress={() => setPool([])}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.reset}>
                  초기화
                </ThemedText>
              </Pressable>
            )}
          </View>
          <NumberPicker fixed={pool} excluded={[]} onPress={onPickNumber} />
          <ThemedText type="small" themeColor="textSecondary">
            {pool.length >= 6
              ? `고른 ${pool.length}개로 만들 수 있는 조합은 ${comb(pool.length, 6).toLocaleString('ko-KR')}가지예요. 그중에서 겹치지 않게 뽑아요.`
              : '마음에 드는 번호를 7개 이상 고르면, 그 번호들로만 여러 세트를 만들어요.'}
          </ThemedText>
        </Card>
      )}

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
        ) : hydrated && mode === 'phrase' ? (
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              문구를 넣으면 {nextRound}회 번호를 뽑아 드려요. 같은 문구는 이번 주 내내 같은 번호가 나와요.
            </ThemedText>
          </Card>
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
        {mode !== 'phrase' && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setRoll((r) => r + 1)}
            style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryText}>다시 뽑기</ThemedText>
          </Pressable>
        )}
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            disabled={sets.length === 0 || saved}
            onPress={save}
            style={({ pressed }) => [
              styles.button,
              styles.secondary,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
              (sets.length === 0 || saved) && styles.disabled,
            ]}>
            <ThemedText type="smallBold">{saved ? '저장함' : '내 번호에 저장'}</ThemedText>
          </Pressable>
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
        {saved && (
          <Link href="/my" style={styles.toast}>
            <ThemedText type="linkPrimary">내 번호에서 보기 →</ThemedText>
          </Link>
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

        {!isWheel && (
        <>
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
        </>
        )}
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
  disabled: { opacity: 0.4 },
  input: { borderWidth: 1.5, borderRadius: Spacing.three, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  modeItem: { flexGrow: 1, flexBasis: 150 },
  modeCard: { padding: 12, borderRadius: Spacing.three, gap: 2, borderWidth: 1.5, borderColor: 'transparent', height: '100%' },
  modeSelected: { borderColor: '#208AEF' },
  modeDesc: { fontSize: 12, lineHeight: 16 },
});
