import { router, useLocalSearchParams } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Pill } from '@/components/card';
import { DrawNumbers } from '@/components/draw-numbers';
import { Icon } from '@/components/icon';
import { LottoBall, LottoBalls } from '@/components/lotto-ball';
import { PendingRoundText, usePendingRound } from '@/components/next-draw';
import { NumberPicker } from '@/components/number-picker';
import { Page } from '@/components/page';
import { QrScanner } from '@/components/qr-scanner';
import { TabStrip } from '@/components/tab-strip';
import { ThemedText } from '@/components/themed-text';
import { RANK_COLORS } from '@/components/ticket-result';
import { Radius, Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useDrawLookup, useLatestDraw } from '@/hooks/use-latest-draw';
import { addTickets, removeTickets, restoreTickets, useMyTickets, type MyTicket } from '@/hooks/use-my-tickets';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import { formatCount, formatDateDots, formatKRW, formatKRWShort } from '@/lib/format';
import { checkTicket, parseNumbers, RANK_RULES, type CheckResult, type TicketQr } from '@/lib/lotto/check';
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
          {draw ? `${formatDateDots(draw.drawDate)} 추첨` : '결과 없음'}
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

// Every game on a scanned ticket, checked against its round, with one save for the whole ticket.
function QrResult({ ticket, onSaved, onRescan }: { ticket: TicketQr; onSaved: (msg: string) => void; onRescan: () => void }) {
  const theme = useTheme();
  const lookup = useDrawLookup();
  const draw = lookup(ticket.round);
  const results = draw ? ticket.games.map((g) => checkTicket(g, draw)) : [];
  const won = results.filter((r) => r.rank);
  const prize = won.reduce((sum, r) => sum + r.prize, 0);
  const save = async () => {
    const added = await addTickets(ticket.round, ticket.games, 'qr');
    onSaved(added ? `${ticket.round}회 번호로 ${added}장 저장했어요` : `이미 ${ticket.round}회에 저장한 번호예요`);
  };
  return (
    <Card style={styles.group}>
      <View style={styles.between}>
        <ThemedText type="heading">{ticket.round}회 용지</ThemedText>
        {!draw ? (
          <Pill label={`추첨 전 · ${ticket.games.length}게임`} color={theme.primary} soft />
        ) : won.length ? (
          <Pill label={`${ticket.games.length}게임 중 ${won.length}개 당첨`} color={theme.success} soft />
        ) : (
          <Pill label={`${ticket.games.length}게임 · 당첨 없음`} color={theme.textTertiary} soft />
        )}
      </View>
      {draw && won.length > 0 && (
        <View style={styles.amountBlock}>
          <ThemedText style={[styles.amount, { color: theme.primary }]}>{formatKRW(prize)}</ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            세금 떼기 전 금액이에요
          </ThemedText>
        </View>
      )}
      {draw ? (
        <View style={[styles.groupDraw, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="caption" themeColor="textTertiary">
            당첨번호
          </ThemedText>
          <DrawNumbers numbers={draw.numbers} bonus={draw.bonus} size={22} />
        </View>
      ) : (
        <PendingRoundText round={ticket.round} />
      )}
      <View>
        {ticket.games.map((g, i) => {
          const r = draw ? results[i] : null;
          return (
            <View key={i} style={[styles.ticket, i < ticket.games.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
              <ThemedText type="caption" themeColor="textTertiary" style={styles.gameLabel}>
                {'ABCDE'[i]}
              </ThemedText>
              <View style={styles.ticketBody}>
                <LottoBalls numbers={g} size={32} highlight={r ? r.matched : undefined} ring={r?.bonusMatched && draw ? [draw.bonus] : undefined} />
                {r && <RankPill result={r} />}
              </View>
            </View>
          );
        })}
      </View>
      <Button label={`${ticket.round}회 번호로 ${ticket.games.length}장 저장`} icon="bookmark" variant="primary" onPress={save} />
      <Button label="다른 용지 스캔" icon="qr" variant="ghost" onPress={onRescan} />
      <ThemedText type="caption" themeColor="textTertiary">
        QR 결과는 참고용이에요. 당첨금을 받을 때는 실물 용지로 확인해 주세요.
      </ThemedText>
    </Card>
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
  const [scanning, setScanning] = useState(false);
  const [qr, setQr] = useState<TicketQr | null>(null);
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
  const save = async (target: number) => {
    const added = await addTickets(target, [sorted], 'manual');
    onSaved(added ? `${target}회 번호로 저장했어요` : `이미 ${target}회에 저장한 번호예요`);
  };

  return (
    <>
      <QrScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onTicket={(t) => {
          setQr(t);
          if (t.round <= nextRound) setRound(t.round);
        }}
      />
      <Button label="복권 용지 QR 스캔" icon="qr" variant="tonal" size="lg" onPress={() => setScanning(true)} />
      {qr && <QrResult ticket={qr} onSaved={onSaved} onRescan={() => setScanning(true)} />}
      <Card>
        <RoundSelector round={round} max={nextRound} draw={draw} onChange={setRound} />
        {draw ? (
          <View style={[styles.winning, { backgroundColor: theme.backgroundSelected }]}>
            <DrawNumbers numbers={draw.numbers} bonus={draw.bonus} size={32} fill />
          </View>
        ) : (
          <View style={[styles.winning, { backgroundColor: theme.backgroundSelected }]}>
            <PendingRoundText round={round} />
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
              {round}회 결과가 아직 없어요
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              저장해 두면 결과가 나오는 대로 내 번호에 표시돼요.
            </ThemedText>
          </View>
        ) : null}
        {numbers.length === 6 &&
          (draw ? (
            <View style={styles.saveRow}>
              <Button
                label={`${round}회 번호로 저장`}
                icon="bookmark"
                variant="tonal"
                onPress={() => save(round)}
                style={styles.grow}
              />
              <Button
                label={`${nextRound}회(다음 추첨)로 저장`}
                icon="bookmark"
                variant="primary"
                onPress={() => save(nextRound)}
                style={styles.grow}
              />
            </View>
          ) : (
            <Button label={`${round}회 번호로 저장`} icon="bookmark" variant="primary" size="lg" onPress={() => save(round)} />
          ))}
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

function RankPill({ result }: { result: CheckResult }) {
  const theme = useTheme();
  const color = result.rank ? RANK_COLORS[result.rank] : theme.textTertiary;
  return (
    <View style={[styles.rankPill, { backgroundColor: result.rank ? `${color}1A` : theme.backgroundSelected }]}>
      <ThemedText type="caption" style={[styles.rankText, { color }]}>
        {result.rank ? `${result.rank}등 ${formatKRW(result.prize)}` : '낙첨'}
      </ThemedText>
    </View>
  );
}

function TicketLine({ ticket, draw, onRemove, last }: { ticket: MyTicket; draw?: Draw; onRemove: () => void; last: boolean }) {
  const theme = useTheme();
  const r = draw ? checkTicket(ticket.numbers, draw) : null;
  return (
    <View style={[styles.ticket, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
      <View style={styles.ticketBody}>
        <LottoBalls
          numbers={ticket.numbers}
          size={32}
          highlight={r ? r.matched : undefined}
          ring={r?.bonusMatched && draw ? [draw.bonus] : undefined}
        />
        {r && <RankPill result={r} />}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${ticket.numbers.join(' ')} 삭제`}
        onPress={onRemove}
        hitSlop={10}
        style={({ pressed }) => pressed && styles.pressed}>
        <Icon name="close" size={16} color={theme.textTertiary} />
      </Pressable>
    </View>
  );
}

const WEEK = 7 * 86_400_000;

// A round still waiting for its draw: status pill, a bar filling up over the week, countdown text.
function PendingHeader({ round, count }: { round: number; count: number }) {
  const theme = useTheme();
  const { phase, msToDraw } = usePendingRound(round);
  const progress = phase === 'before' ? Math.min(1, Math.max(0.03, 1 - msToDraw / WEEK)) : 1;
  return (
    <>
      <View style={styles.between}>
        <ThemedText type="heading">{round}회</ThemedText>
        {phase === 'before' ? (
          <Pill label={`추첨 전 · ${count}장`} color={theme.primary} soft />
        ) : (
          <Pill label={`결과 확인 중 · ${count}장`} color={theme.warning} soft />
        )}
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.progressBar,
            { width: `${progress * 100}%`, backgroundColor: phase === 'before' ? theme.primary : theme.warning },
          ]}
        />
      </View>
      <PendingRoundText round={round} />
    </>
  );
}

function DrawnHeader({ group }: { group: Group & { draw: Draw } }) {
  const theme = useTheme();
  const { round, draw, tickets } = group;
  const won = tickets.map((t) => checkTicket(t.numbers, draw)).filter((r) => r.rank);
  const prize = won.reduce((sum, r) => sum + r.prize, 0);
  return (
    <>
      <View style={styles.between}>
        <Pressable accessibilityRole="link" onPress={() => router.push(`/round/${round}`)} style={styles.groupTitle}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {round}회 결과
          </ThemedText>
          <Icon name="chevronRight" size={14} color={theme.textTertiary} />
        </Pressable>
        {won.length ? (
          <Pill label={`${tickets.length}장 중 ${won.length}장 당첨`} color={theme.success} soft />
        ) : (
          <Pill label={`${tickets.length}장 · 당첨 없음`} color={theme.textTertiary} soft />
        )}
      </View>
      {won.length > 0 && (
        <View style={styles.amountBlock}>
          <ThemedText style={[styles.amount, { color: theme.primary }]}>{formatKRW(prize)}</ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            세금 떼기 전 금액이에요
          </ThemedText>
        </View>
      )}
      <View style={[styles.groupDraw, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="caption" themeColor="textTertiary">
          당첨번호
        </ThemedText>
        <DrawNumbers numbers={draw.numbers} bonus={draw.bonus} size={22} />
      </View>
    </>
  );
}

function RoundGroup({ group, onRemove }: { group: Group; onRemove: (t: MyTicket[]) => void }) {
  const { round, draw, tickets } = group;
  return (
    <Card style={styles.group}>
      {draw ? <DrawnHeader group={{ ...group, draw }} /> : <PendingHeader round={round} count={tickets.length} />}
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

function useGroups(): Group[] {
  const { tickets } = useMyTickets();
  const lookup = useDrawLookup();
  return useMemo(() => {
    const map = new Map<number, MyTicket[]>();
    for (const t of tickets) map.set(t.round, [...(map.get(t.round) ?? []), t]);
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([round, list]): Group => ({ round, draw: lookup(round), tickets: list }));
  }, [tickets, lookup]);
}

function SavedTab({ onCheck }: { onCheck: () => void }) {
  const theme = useTheme();
  const groups = useGroups();
  const [undo, setUndo] = useState<MyTicket[] | null>(null);

  const remove = async (list: MyTicket[]) => {
    await removeTickets(list.map((t) => t.id));
    setUndo(list);
  };

  if (groups.length === 0) {
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
          <Button label="당첨 확인에서 입력" variant="primary" onPress={onCheck} style={styles.flex} />
          <Button label="번호 뽑기" variant="tonal" onPress={() => router.push('/generate')} style={styles.flex} />
        </View>
      </Card>
    );
  }

  return (
    <>
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
        <RoundGroup key={g.round} group={g} onRemove={remove} />
      ))}

      <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
        번호는 이 기기에만 저장돼요.
      </ThemedText>
    </>
  );
}

// "저장 7장 · 누적 당첨 5,317만원" for the header.
function useTotalsLine(): string | null {
  const groups = useGroups();
  return useMemo(() => {
    let count = 0;
    let prize = 0;
    for (const g of groups) {
      count += g.tickets.length;
      if (g.draw) for (const t of g.tickets) prize += checkTicket(t.numbers, g.draw).prize;
    }
    if (!count) return null;
    return `저장 ${formatCount(count)}장${prize ? ` · 누적 당첨 ${formatKRWShort(prize)}` : ''}`;
  }, [groups]);
}

export default function MyScreen() {
  const hydrated = useHydrated();
  const params = useLocalSearchParams<{ round?: string; numbers?: string }>();
  const { tickets, loaded } = useMyTickets();
  const totals = useTotalsLine();
  const [toast, setToast] = useToast();
  const initialRound = params.round ? Number(params.round) : null;
  const initialNumbers = params.numbers ? parseNumbers(params.numbers) : [];
  const [tab, setTab] = useState<Tab | null>(null);
  // Links with a round or numbers open the checker; otherwise show saved tickets when there are any.
  // The static HTML has no query string, so the default view is only decided after hydration.
  const current: Tab =
    tab ?? (hydrated && (params.round || params.numbers || (loaded && tickets.length === 0)) ? 'check' : 'saved');
  const ready = hydrated && loaded;

  return (
    <Page
      title="내 번호"
      subtitle={(ready && current === 'saved' && totals) || '산 번호를 저장하고 당첨을 확인하세요'}
      toast={toast}>
      <TabStrip
        items={[
          { value: 'saved', label: ready && tickets.length ? `저장한 번호 ${tickets.length}` : '저장한 번호' },
          { value: 'check', label: '당첨 확인' },
        ]}
        value={current}
        onChange={setTab}
      />
      {/* Saved tickets and the latest draw depend on the device, so the content renders after hydration on web. */}
      {!ready ? (
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
  ticket: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10 },
  saveRow: { gap: Spacing.two },
  grow: { flex: 1 },
  gameLabel: { width: 14, fontWeight: '800' },
  ticketBody: { flex: 1, gap: 6 },
  rankPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  rankText: { fontWeight: '800' },
  amountBlock: { gap: 2 },
  amount: { fontSize: 30, lineHeight: 38, fontWeight: '900', letterSpacing: -1 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 4 },
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
