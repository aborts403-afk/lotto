import { router, useLocalSearchParams } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Pill } from '@/components/card';
import { DrawNumbers } from '@/components/draw-numbers';
import { Icon } from '@/components/icon';
import { LottoBall, LottoBalls } from '@/components/lotto-ball';
import { NextDrawCountdownText } from '@/components/next-draw';
import { NumberPicker } from '@/components/number-picker';
import { Page } from '@/components/page';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { RANK_COLORS } from '@/components/ticket-result';
import { Radius, Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useDrawLookup, useLatestDraw } from '@/hooks/use-latest-draw';
import { addTickets, removeTickets, restoreTickets, useMyTickets, type MyTicket } from '@/hooks/use-my-tickets';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import { formatCount, formatDateDots, formatKRW } from '@/lib/format';
import { checkTicket, parseNumbers, RANK_RULES, type CheckResult } from '@/lib/lotto/check';
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

type Tab = 'saved' | 'check';

// ---------- 당첨 확인 ----------

function RoundSelector({
  round,
  max,
  draw,
  onChange,
}: {
  round: number;
  max: number;
  draw?: Draw;
  onChange: (r: number) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(String(round));
  const [lastRound, setLastRound] = useState(round);
  if (round !== lastRound) {
    // Keep the field in sync when the round changes from the arrows.
    setLastRound(round);
    setText(String(round));
  }
  const commit = () => {
    const n = Number(text);
    if (Number.isInteger(n) && n >= 1 && n <= max) onChange(n);
    else setText(String(round));
  };
  return (
    <View style={styles.selector}>
      <Button
        icon="chevronLeft"
        accessibilityLabel="이전 회차"
        onPress={() => onChange(Math.max(1, round - 1))}
        disabled={round <= 1}
      />
      <View style={styles.selectorCenter}>
        <View style={styles.roundField}>
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.replace(/\D/g, '').slice(0, 5))}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            accessibilityLabel="회차 번호"
            style={[styles.roundInput, { color: theme.text, borderColor: theme.border }]}
          />
          <ThemedText type="heading">회</ThemedText>
        </View>
        <ThemedText type="caption" themeColor="textTertiary">
          {draw ? `${formatDateDots(draw.drawDate)} 추첨` : '추첨 전'}
        </ThemedText>
      </View>
      <Button
        icon="chevronRight"
        accessibilityLabel="다음 회차"
        onPress={() => onChange(Math.min(max, round + 1))}
        disabled={round >= max}
      />
    </View>
  );
}

// Six slots showing the picked numbers in order; empty slots are dashed circles.
function Slots({ numbers, result, bonus }: { numbers: readonly number[]; result?: CheckResult | null; bonus?: number }) {
  const theme = useTheme();
  const sorted = [...numbers].sort((a, b) => a - b);
  return (
    <View style={styles.slots}>
      {Array.from({ length: 6 }, (_, i) =>
        sorted[i] ? (
          <LottoBall
            key={i}
            n={sorted[i]}
            size={40}
            muted={!!result && !result.matched.includes(sorted[i]) && !(result.bonusMatched && sorted[i] === bonus)}
            ring={!!result?.bonusMatched && sorted[i] === bonus}
          />
        ) : (
          <View key={i} style={[styles.slot, { borderColor: theme.border }]} />
        ),
      )}
    </View>
  );
}

function ResultBanner({ result, draw }: { result: CheckResult; draw: Draw }) {
  const theme = useTheme();
  const color = result.rank ? RANK_COLORS[result.rank] : theme.textTertiary;
  return (
    <View style={[styles.banner, { backgroundColor: result.rank ? `${color}14` : theme.backgroundSelected }]}>
      <ThemedText type="caption" themeColor="textTertiary">
        {draw.round}회 결과
      </ThemedText>
      <ThemedText style={[styles.bannerTitle, { color }]}>{result.rank ? `${result.rank}등 당첨` : '낙첨'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {result.rank
          ? `${formatKRW(result.prize)} · ${RANK_RULES[result.rank]}`
          : `${result.matched.length}개 일치 · 3개 이상 맞으면 5등이에요`}
      </ThemedText>
    </View>
  );
}

function CheckTab({
  initialRound,
  initialNumbers,
  onSaved,
}: {
  initialRound: number | null;
  initialNumbers: number[];
  onSaved: (msg: string) => void;
}) {
  const theme = useTheme();
  const latest = useLatestDraw();
  const lookup = useDrawLookup();
  const nextRound = latest.round + 1;
  const [round, setRound] = useState(
    initialRound && initialRound >= 1 && initialRound <= nextRound ? initialRound : latest.round,
  );
  const [numbers, setNumbers] = useState<number[]>(initialNumbers);
  const [text, setText] = useState(initialNumbers.join(' '));
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
    else onSaved('번호는 6개까지 고를 수 있어요');
  };
  const save = async () => {
    const added = await addTickets(round, [sorted], 'manual');
    onSaved(added ? `${round}회 번호로 저장했어요` : '이미 저장한 번호예요');
    if (added) setBoth([]);
  };

  return (
    <>
      <Card>
        <RoundSelector round={round} max={nextRound} draw={draw} onChange={setRound} />
        {draw ? (
          <View style={[styles.winning, { backgroundColor: theme.backgroundSelected }]}>
            <DrawNumbers numbers={draw.numbers} bonus={draw.bonus} size={32} fill />
          </View>
        ) : (
          <View style={[styles.winning, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              아직 추첨 전이에요. 저장해 두면 추첨 뒤 결과를 알려 드려요.
            </ThemedText>
          </View>
        )}
      </Card>

      <Card>
        <View style={styles.between}>
          <ThemedText type="heading">내 번호</ThemedText>
          {numbers.length > 0 && <Button label="모두 지우기" size="sm" variant="ghost" onPress={() => setBoth([])} />}
        </View>
        <Slots numbers={numbers} result={result} bonus={draw?.bonus} />
        {result && draw ? (
          <ResultBanner result={result} draw={draw} />
        ) : numbers.length === 6 ? (
          <View style={[styles.banner, { backgroundColor: theme.primarySoft }]}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {round}회 추첨 전이에요
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              저장해 두면 토요일 추첨 뒤 결과가 내 번호에 나와요.
            </ThemedText>
          </View>
        ) : null}
        {numbers.length === 6 && <Button label="내 번호에 저장" icon="bookmark" variant="primary" size="lg" onPress={save} />}
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            setNumbers(parseNumbers(v));
          }}
          placeholder="숫자로 입력해도 돼요 (예: 3 11 24 30 41 45)"
          placeholderTextColor={theme.textTertiary}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="번호 직접 입력"
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
        />
        <NumberPicker fixed={numbers} onPress={onPick} />
        {numbers.length < 6 && (
          <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
            번호를 {6 - numbers.length}개 더 골라 주세요
          </ThemedText>
        )}
      </Card>
    </>
  );
}

// ---------- 저장한 번호 ----------

type Group = { round: number; draw?: Draw; tickets: MyTicket[] };

function TicketLine({ ticket, draw, onRemove, last }: { ticket: MyTicket; draw?: Draw; onRemove: () => void; last: boolean }) {
  const theme = useTheme();
  const r = draw ? checkTicket(ticket.numbers, draw) : null;
  return (
    <View style={[styles.ticket, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
      <View style={styles.flex}>
        <LottoBalls
          numbers={ticket.numbers}
          size={32}
          highlight={r ? r.matched : undefined}
          ring={r?.bonusMatched && draw ? [draw.bonus] : undefined}
        />
        {r && (
          <ThemedText
            type="caption"
            style={{ color: r.rank ? RANK_COLORS[r.rank] : theme.textTertiary, fontWeight: r.rank ? '700' : '500' }}>
            {r.rank ? `${r.rank}등 · ${formatKRW(r.prize)}` : `낙첨 · ${r.matched.length}개 일치`}
          </ThemedText>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${ticket.numbers.join(' ')} 삭제`}
        onPress={onRemove}
        hitSlop={10}
        style={({ pressed }) => pressed && styles.pressed}>
        <Icon name="close" size={18} color={theme.textTertiary} />
      </Pressable>
    </View>
  );
}

function RoundGroup({ group, nextRound, onRemove }: { group: Group; nextRound: number; onRemove: (t: MyTicket[]) => void }) {
  const theme = useTheme();
  const { round, draw, tickets } = group;
  const won = draw ? tickets.map((t) => checkTicket(t.numbers, draw)).filter((r) => r.rank) : [];
  const prize = won.reduce((sum, r) => sum + r.prize, 0);
  const best = won.length ? Math.min(...won.map((r) => r.rank!)) : null;

  return (
    <Card style={styles.group}>
      <View style={styles.between}>
        <Pressable onPress={draw ? () => router.push(`/round/${round}`) : undefined} disabled={!draw} style={styles.groupTitle}>
          <ThemedText type="heading">{round}회</ThemedText>
          {draw && <Icon name="chevronRight" size={16} color={theme.textTertiary} />}
        </Pressable>
        {!draw ? (
          <Pill label="추첨 전" color={theme.primary} soft />
        ) : best ? (
          <Pill label={`${won.length}장 당첨 · ${formatKRW(prize)}`} color={RANK_COLORS[best as 1]} soft />
        ) : (
          <Pill label="당첨 없음" color={theme.textTertiary} soft />
        )}
      </View>
      {draw ? (
        <View style={[styles.groupDraw, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="caption" themeColor="textTertiary">
            당첨번호
          </ThemedText>
          <DrawNumbers numbers={draw.numbers} bonus={draw.bonus} size={24} />
        </View>
      ) : round === nextRound ? (
        <NextDrawCountdownText />
      ) : (
        <ThemedText type="caption" themeColor="textTertiary">
          결과를 기다리는 중이에요
        </ThemedText>
      )}
      <View>
        {tickets.map((t, i) => (
          <TicketLine key={t.id} ticket={t} draw={draw} onRemove={() => onRemove([t])} last={i === tickets.length - 1} />
        ))}
      </View>
      <Button
        label={`${round}회 번호 모두 삭제`}
        size="sm"
        variant="ghost"
        icon="trash"
        onPress={() => onRemove(tickets)}
        style={styles.alignEnd}
      />
    </Card>
  );
}

function SavedTab({ onCheck }: { onCheck: () => void }) {
  const theme = useTheme();
  const { tickets } = useMyTickets();
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
    return { checked, won, prize, waiting: tickets.length - checked };
  }, [groups, tickets.length]);

  const remove = async (list: MyTicket[]) => {
    await removeTickets(list.map((t) => t.id));
    setUndo(list);
  };

  if (tickets.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
          <Icon name="ticket" size={28} color={theme.primary} />
        </View>
        <ThemedText type="heading" style={styles.center}>
          저장한 번호가 없어요
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          산 번호나 뽑은 번호를 저장해 두면{'\n'}추첨이 끝난 뒤 당첨 결과를 바로 보여 드려요.
        </ThemedText>
        <View style={styles.emptyActions}>
          <Button label="번호 입력하기" variant="primary" onPress={onCheck} style={styles.flex} />
          <Button label="번호 뽑기" variant="tonal" onPress={() => router.push('/generate')} style={styles.flex} />
        </View>
      </Card>
    );
  }

  return (
    <>
      <Card style={styles.summary}>
        <View style={styles.summaryItem}>
          <ThemedText type="caption" themeColor="textTertiary">
            저장
          </ThemedText>
          <ThemedText type="heading">{formatCount(tickets.length)}장</ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryItem}>
          <ThemedText type="caption" themeColor="textTertiary">
            당첨
          </ThemedText>
          <ThemedText type="heading">
            {formatCount(totals.won)}
            <ThemedText type="small" themeColor="textTertiary">
              /{formatCount(totals.checked)}장
            </ThemedText>
          </ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryItem}>
          <ThemedText type="caption" themeColor="textTertiary">
            당첨금
          </ThemedText>
          <ThemedText type="heading" style={totals.prize ? { color: theme.primary } : undefined}>
            {totals.prize ? formatKRW(totals.prize) : '0원'}
          </ThemedText>
        </View>
      </Card>

      {undo && (
        <View style={[styles.undo, { backgroundColor: theme.text }]}>
          <ThemedText type="small" style={{ color: theme.background }}>
            {undo.length}장을 삭제했어요
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void restoreTickets(undo);
              setUndo(null);
            }}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              되돌리기
            </ThemedText>
          </Pressable>
        </View>
      )}

      {groups.map((g) => (
        <RoundGroup key={g.round} group={g} nextRound={nextRound} onRemove={remove} />
      ))}

      <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
        번호는 이 기기에만 저장돼요. 당첨금은 세금 떼기 전 금액이에요.
      </ThemedText>
    </>
  );
}

export default function MyScreen() {
  const hydrated = useHydrated();
  const params = useLocalSearchParams<{ round?: string; numbers?: string }>();
  const { tickets, loaded } = useMyTickets();
  const [toast, setToast] = useToast();
  const initialRound = params.round ? Number(params.round) : null;
  const initialNumbers = params.numbers ? parseNumbers(params.numbers) : [];
  const [tab, setTab] = useState<Tab | null>(null);
  // Links with a round or numbers open the checker; otherwise show saved tickets when there are any.
  // The static HTML has no query string, so the default tab is only decided after hydration
  // (otherwise the server-rendered selection would stick).
  const current: Tab =
    tab ?? (hydrated && (params.round || params.numbers || (loaded && tickets.length === 0)) ? 'check' : 'saved');

  return (
    <Page title="내 번호" subtitle="당첨 확인하고, 산 번호를 모아 두세요" toast={toast}>
      <Segmented
        options={[
          { value: 'saved', label: loaded && tickets.length ? `저장한 번호 ${tickets.length}` : '저장한 번호' },
          { value: 'check', label: '당첨 확인' },
        ]}
        value={current}
        onChange={setTab}
      />
      {/* Saved tickets and the latest draw depend on the device, so the content renders after hydration on web. */}
      {!hydrated || !loaded ? (
        <Card style={styles.loading}>
          <ThemedText type="small" themeColor="textTertiary">
            불러오는 중…
          </ThemedText>
        </Card>
      ) : current === 'check' ? (
        <CheckTab initialRound={initialRound} initialNumbers={initialNumbers} onSaved={setToast} />
      ) : (
        <SavedTab onCheck={() => setTab('check')} />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1, gap: 4 },
  center: { textAlign: 'center', alignItems: 'center' },
  pressed: { opacity: 0.6 },
  alignEnd: { alignSelf: 'flex-end' },
  selector: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  selectorCenter: { flex: 1, alignItems: 'center', gap: 2 },
  roundField: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roundInput: { width: 84, fontSize: 24, fontWeight: '800', textAlign: 'center', paddingVertical: 2, borderBottomWidth: 2 },
  winning: { borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  slots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  slot: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed' },
  banner: { borderRadius: Radius.md, padding: Spacing.three, alignItems: 'center', gap: 2 },
  bannerTitle: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  input: { borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 15 },
  group: { gap: 12 },
  groupTitle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  groupDraw: { borderRadius: Radius.md, padding: 12, gap: 6 },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 12 },
  summary: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.three },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  undo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.five },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyActions: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch', marginTop: Spacing.two },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
});
