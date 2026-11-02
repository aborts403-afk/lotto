import { Link, useLocalSearchParams } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DrawNumbers } from '@/components/draw-numbers';
import { NextDrawCountdownText } from '@/components/next-draw';
import { NumberPicker } from '@/components/number-picker';
import { Page } from '@/components/page';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TicketResult } from '@/components/ticket-result';
import { Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useDrawLookup, useLatestDraw } from '@/hooks/use-latest-draw';
import { addTickets, removeTickets, restoreTickets, useMyTickets, type MyTicket } from '@/hooks/use-my-tickets';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import { formatCount, formatDateDots, formatKRW } from '@/lib/format';
import { checkTicket, parseNumbers, RANK_RULES } from '@/lib/lotto/check';
import type { Draw } from '@/lib/lotto/draws';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateMetadata(): Metadata {
  const title = `로또 당첨 확인 - 내 번호 저장하고 결과 받기 | ${SITE_NAME}`;
  const description =
    '로또 번호 6개와 회차를 넣으면 몇 등인지, 당첨금이 얼마인지 바로 알려 드려요. 번호를 저장해 두면 추첨 뒤 결과를 자동으로 확인해요.';
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/my` },
    openGraph: { title, description, url: `${SITE_URL}/my`, siteName: SITE_NAME, type: 'website' },
  };
}

function RoundStepper({ round, max, onChange }: { round: number; max: number; onChange: (r: number) => void }) {
  const theme = useTheme();
  const [text, setText] = useState(String(round));
  const [lastRound, setLastRound] = useState(round);
  if (round !== lastRound) {
    // Keep the field in sync when the round changes from the arrows.
    setLastRound(round);
    setText(String(round));
  }
  const commit = (value: string) => {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= max) onChange(n);
    else setText(String(round));
  };
  return (
    <View style={styles.stepper}>
      <Button label="‹" accessibilityLabel="이전 회차" onPress={() => onChange(Math.max(1, round - 1))} disabled={round <= 1} style={styles.stepButton} />
      <View style={[styles.roundField, { borderColor: theme.chartGrid }]}>
        <TextInput
          value={text}
          onChangeText={(v) => setText(v.replace(/\D/g, '').slice(0, 5))}
          onBlur={() => commit(text)}
          onSubmitEditing={() => commit(text)}
          keyboardType="number-pad"
          returnKeyType="done"
          accessibilityLabel="회차"
          style={[styles.roundInput, { color: theme.text }]}
        />
        <ThemedText type="smallBold">회</ThemedText>
      </View>
      <Button label="›" accessibilityLabel="다음 회차" onPress={() => onChange(Math.min(max, round + 1))} disabled={round >= max} style={styles.stepButton} />
      {round !== max && <Button label="최신" onPress={() => onChange(max)} style={styles.stepButton} />}
    </View>
  );
}

function CheckCard({ initialRound, initialNumbers }: { initialRound: number | null; initialNumbers: number[] }) {
  const theme = useTheme();
  const latest = useLatestDraw();
  const lookup = useDrawLookup();
  const nextRound = latest.round + 1;
  const [round, setRound] = useState(initialRound && initialRound <= nextRound ? initialRound : latest.round);
  const [numbers, setNumbers] = useState<number[]>(initialNumbers);
  const [text, setText] = useState(initialNumbers.join(' '));
  const [toast, setToast] = useToast();
  const draw = lookup(round);
  const sorted = [...numbers].sort((a, b) => a - b);
  const result = draw && numbers.length === 6 ? checkTicket(sorted, draw) : null;

  const setBoth = (next: number[]) => {
    setNumbers(next);
    setText(next.join(' '));
  };
  const onPick = (n: number) => {
    if (numbers.includes(n)) setBoth(numbers.filter((x) => x !== n));
    else if (numbers.length < 6) setBoth([...numbers, n]);
    else setToast('번호는 6개까지 고를 수 있어요.');
  };
  const save = async () => {
    const added = await addTickets(round, [sorted], 'manual');
    setToast(added ? `${round}회 번호로 저장했어요.` : '이미 저장한 번호예요.');
  };

  return (
    <Card style={styles.check}>
      <ThemedText type="smallBold">당첨 확인</ThemedText>
      <RoundStepper round={round} max={nextRound} onChange={setRound} />
      {draw ? (
        <View style={styles.drawLine}>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDateDots(draw.drawDate)} 추첨
          </ThemedText>
          <DrawNumbers numbers={draw.numbers} bonus={draw.bonus} size={26} />
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {round}회는 아직 추첨 전이에요. 저장해 두면 추첨 뒤 결과를 보여 드려요.
        </ThemedText>
      )}

      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          setNumbers(parseNumbers(v));
        }}
        placeholder="번호 6개 입력 (예: 3 11 24 30 41 45)"
        placeholderTextColor={theme.textSecondary}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel="번호 입력"
        style={[styles.input, { color: theme.text, borderColor: theme.chartGrid }]}
      />
      <NumberPicker fixed={numbers} excluded={[]} onPress={onPick} />

      {numbers.length === 6 ? (
        <ThemedView type="backgroundSelected" style={styles.result}>
          {result ? (
            <>
              <TicketResult numbers={sorted} draw={draw} size={34} />
              <ThemedText type="small" themeColor="textSecondary">
                {result.rank ? `${result.rank}등: ${RANK_RULES[result.rank]}` : '3개 이상 맞으면 5등이에요.'}
              </ThemedText>
            </>
          ) : (
            <TicketResult numbers={sorted} size={34} />
          )}
        </ThemedView>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          번호를 {6 - numbers.length}개 더 고르세요.
        </ThemedText>
      )}

      <View style={styles.row}>
        <Button label="내 번호에 저장" variant="primary" onPress={save} disabled={numbers.length !== 6} style={styles.flex} />
        <Button label="지우기" onPress={() => setBoth([])} disabled={numbers.length === 0} style={styles.flex} />
      </View>
      {toast && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center} accessibilityLiveRegion="polite">
          {toast}
        </ThemedText>
      )}
    </Card>
  );
}

type Group = { round: number; draw?: Draw; tickets: MyTicket[] };

function RoundGroup({ group, nextRound, onRemove }: { group: Group; nextRound: number; onRemove: (t: MyTicket[]) => void }) {
  const { round, draw, tickets } = group;
  const won = draw ? tickets.map((t) => checkTicket(t.numbers, draw)).filter((r) => r.rank) : [];
  const prize = won.reduce((sum, r) => sum + r.prize, 0);
  const status = !draw ? '결과 기다리는 중' : won.length ? `${won.length}장 당첨 · ${formatKRW(prize)}` : '당첨 없음';

  return (
    <Card>
      <View style={styles.between}>
        <View>
          {draw ? (
            <Link href={`/round/${round}`}>
              <ThemedText type="smallBold">{round}회</ThemedText>
            </Link>
          ) : (
            <ThemedText type="smallBold">{round}회</ThemedText>
          )}
          {!draw && round === nextRound ? (
            <NextDrawCountdownText />
          ) : (
            <ThemedText type="small" themeColor={won.length ? 'text' : 'textSecondary'}>
              {status}
            </ThemedText>
          )}
        </View>
        <Pressable accessibilityRole="button" onPress={() => onRemove(tickets)} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.underline}>
            회차 삭제
          </ThemedText>
        </Pressable>
      </View>
      {draw && <DrawNumbers numbers={draw.numbers} bonus={draw.bonus} size={24} />}
      {tickets.map((t) => (
        <View key={t.id} style={styles.ticket}>
          <View style={styles.flex}>
            <TicketResult numbers={t.numbers} draw={draw} size={30} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t.numbers.join(' ')} 삭제`} onPress={() => onRemove([t])} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              ✕
            </ThemedText>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

function SavedTickets() {
  const { tickets, loaded } = useMyTickets();
  const lookup = useDrawLookup();
  const nextRound = useLatestDraw().round + 1;
  const [undo, setUndo] = useState<MyTicket[] | null>(null);

  const groups = useMemo(() => {
    const map = new Map<number, MyTicket[]>();
    for (const t of tickets) map.set(t.round, [...(map.get(t.round) ?? []), t]);
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([round, list]): Group => ({ round, draw: lookup(round), tickets: list }));
  }, [tickets, lookup]);

  const totals = useMemo(() => {
    let checked = 0;
    let won = 0;
    let prize = 0;
    for (const g of groups) {
      if (!g.draw) continue;
      for (const t of g.tickets) {
        const r = checkTicket(t.numbers, g.draw);
        checked++;
        if (r.rank) {
          won++;
          prize += r.prize;
        }
      }
    }
    return { checked, won, prize };
  }, [groups]);

  const remove = async (list: MyTicket[]) => {
    await removeTickets(list.map((t) => t.id));
    setUndo(list);
  };

  if (!loaded) return null;

  return (
    <View style={styles.section}>
      <View style={styles.between}>
        <ThemedText type="smallBold">저장한 번호</ThemedText>
        {tickets.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {formatCount(tickets.length)}장
          </ThemedText>
        )}
      </View>

      {undo && (
        <ThemedView type="backgroundSelected" style={[styles.undo, styles.between]}>
          <ThemedText type="small">{undo.length}장을 삭제했어요.</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void restoreTickets(undo);
              setUndo(null);
            }}>
            <ThemedText type="smallBold" style={styles.underline}>
              되돌리기
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {tickets.length === 0 ? (
        <Card>
          <ThemedText type="small">아직 저장한 번호가 없어요.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            번호 생성에서 뽑은 번호를 저장하거나, 위에서 산 번호를 입력해 저장하세요. 추첨이 끝나면 여기서 결과를 바로 볼 수
            있어요.
          </ThemedText>
          <Link href="/generate">
            <ThemedText type="linkPrimary">번호 뽑으러 가기 →</ThemedText>
          </Link>
        </Card>
      ) : (
        <>
          {totals.checked > 0 && (
            <Card>
              <ThemedText type="small">
                추첨이 끝난 번호 {formatCount(totals.checked)}장 중 {formatCount(totals.won)}장 당첨
                {totals.won ? ` · 합계 ${formatKRW(totals.prize)}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                1,000원짜리 {formatCount(totals.checked)}장이면 {formatKRW(totals.checked * 1000)}이에요. 당첨금은 세금 떼기 전
                금액이에요.
              </ThemedText>
            </Card>
          )}
          {groups.map((g) => (
            <RoundGroup key={g.round} group={g} nextRound={nextRound} onRemove={remove} />
          ))}
        </>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        저장한 번호는 이 기기에만 남아요. 앱을 지우거나 브라우저 데이터를 지우면 함께 사라져요.
      </ThemedText>
    </View>
  );
}

export default function MyScreen() {
  const hydrated = useHydrated();
  const params = useLocalSearchParams<{ round?: string; numbers?: string }>();
  const initialRound = params.round ? Number(params.round) : null;
  const initialNumbers = params.numbers ? parseNumbers(params.numbers) : [];

  return (
    <Page>
      <View style={styles.header}>
        <ThemedText type="subtitle">내 번호</ThemedText>
        <ThemedText themeColor="textSecondary">당첨 확인하고, 산 번호를 저장해 두세요</ThemedText>
      </View>
      {/* Both parts depend on the device (saved tickets, latest draw), so they render after hydration on web. */}
      {hydrated ? (
        <>
          <CheckCard initialRound={initialRound} initialNumbers={initialNumbers} />
          <SavedTickets />
        </>
      ) : (
        <Card style={styles.placeholder}>
          <ThemedText type="small" themeColor="textSecondary">
            불러오는 중…
          </ThemedText>
        </Card>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  check: { gap: Spacing.three },
  section: { gap: Spacing.two },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepButton: { paddingHorizontal: 14 },
  roundField: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: Spacing.three, paddingHorizontal: 12, gap: 4 },
  roundInput: { width: 64, paddingVertical: 8, fontSize: 18, fontWeight: '700', textAlign: 'right' },
  drawLine: { gap: 6 },
  input: { borderWidth: 1.5, borderRadius: Spacing.three, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  result: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingTop: 6 },
  undo: { padding: 12, borderRadius: Spacing.three },
  underline: { textDecorationLine: 'underline' },
  placeholder: { minHeight: 120, justifyContent: 'center', alignItems: 'center' },
});
