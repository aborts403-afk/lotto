import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Card, Pill, Section } from '@/components/card';
import { Chips } from '@/components/chips';
import { MapButton } from '@/components/map-button';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useLatestDraw } from '@/hooks/use-latest-draw';
import { useTheme } from '@/hooks/use-theme';
import { normalizeRegion, regionRank, staticStoresThrough, type WinningTicket } from '@/lib/lotto/stores';
import { SITE_URL } from '@/lib/site';

export const FIRST_ROUND_WITH_STORES = 262;

async function getJson(url: string): Promise<WinningTicket[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as WinningTicket[]; // throws on an HTML fallback page, too
}

// Finalized rounds come from the static file made at build time (no Worker request, no D1 read);
// recent rounds, or a missing file, from the API. On web the file is on the same origin.
function loadTickets(round: number, latestRound: number): Promise<WinningTicket[]> {
  const api = () => getJson(`${SITE_URL}/api/draws/${round}/stores`);
  if (round > staticStoresThrough(latestRound)) return api();
  const base = Platform.OS === 'web' ? '' : SITE_URL;
  return getJson(`${base}/data/stores/${round}.json`).catch(api);
}

const ALL = '전체';
const UNKNOWN = '기타';

type State = { round: number } & ({ status: 'error' } | { status: 'done'; tickets: WinningTicket[] });

const regionOf = (t: WinningTicket) => normalizeRegion(t.storeId, t.region) ?? UNKNOWN;

function TicketLine({ t, last }: { t: WinningTicket; last: boolean }) {
  const theme = useTheme();
  const address = t.address?.trim();
  return (
    <View style={[styles.line, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <ThemedText type="smallBold" style={styles.shrink}>
            {t.isInternet ? '인터넷 (동행복권)' : (t.storeName ?? '-')}
          </ThemedText>
          {t.pickType && <Pill label={t.pickType} color={t.pickType === '자동' ? theme.primary : theme.warning} soft />}
          {t.status === '폐점' && <Pill label="폐점" color={theme.textTertiary} soft />}
        </View>
        {!t.isInternet && address ? (
          <ThemedText type="caption" themeColor="textTertiary">
            {address}
          </ThemedText>
        ) : null}
      </View>
      {!t.isInternet && address ? <MapButton place={{ name: t.storeName, address, lat: t.lat, lng: t.lng }} /> : null}
    </View>
  );
}

function TicketList({ tickets }: { tickets: WinningTicket[] }) {
  return (
    <View>
      {tickets.map((t, i) => (
        <TicketLine key={`${t.rank}-${t.seq}`} t={t} last={i === tickets.length - 1} />
      ))}
    </View>
  );
}

// 1st- and 2nd-prize winning stores of a round, loaded from the API (not bundled: ~60 rows per round),
// with a region filter and a Naver Map link per store.
export function RoundStores({ round, firstWinners }: { round: number; firstWinners: number }) {
  const hydrated = useHydrated();
  const latestRound = useLatestDraw().round;
  // Result for the round it was loaded for; anything else (first render, round changed) is "loading".
  const [loaded, setLoaded] = useState<State | null>(null);
  const state = loaded?.round === round ? loaded : { status: 'loading' as const };
  const [region, setRegion] = useState(ALL);
  const [rank, setRank] = useState<1 | 2>(1);

  useEffect(() => {
    if (!hydrated || round < FIRST_ROUND_WITH_STORES) return;
    let cancelled = false;
    loadTickets(round, latestRound)
      .then((tickets) => !cancelled && setLoaded({ round, status: 'done', tickets }))
      .catch(() => !cancelled && setLoaded({ round, status: 'error' }));
    return () => {
      cancelled = true;
    };
    // latestRound only picks the source (static file or API), so a newer round arriving does not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, round]);

  const tickets = useMemo(() => (loaded?.round === round && loaded.status === 'done' ? loaded.tickets : []), [loaded, round]);
  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tickets) counts.set(regionOf(t), (counts.get(regionOf(t)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => regionRank(a[0]) - regionRank(b[0]));
  }, [tickets]);

  if (round < FIRST_ROUND_WITH_STORES) return null;

  // A region picked on another round may not exist here; fall back to all.
  const active = region === ALL || regions.some(([r]) => r === region) ? region : ALL;
  const inRegion = (t: WinningTicket) => active === ALL || regionOf(t) === active;
  const countFor = (r: 1 | 2, reg: string) => tickets.filter((t) => t.rank === r && (reg === ALL || regionOf(t) === reg)).length;
  const shown = tickets.filter((t) => t.rank === rank && inRegion(t));
  const totalFirst = countFor(1, ALL);
  const totalSecond = countFor(2, ALL);

  const emptyMessage =
    active !== ALL
      ? `${active}에서 나온 ${rank}등은 없어요.`
      : rank === 1 && firstWinners === 0
        ? '이 회차는 1등이 없었어요.'
        : '아직 판매점 정보가 올라오지 않았어요. 보통 추첨 다음 날까지 나와요.';

  return (
    <Section
      title="당첨 판매점"
      description={
        state.status === 'done'
          ? `1등 ${totalFirst}곳 · 2등 ${totalSecond}곳 · 지도 버튼을 누르면 네이버 지도로 열려요`
          : undefined
      }>
      {state.status === 'done' && tickets.length > 0 && (
        <>
          {/* Tab counts follow the region filter; region chip counts follow the selected rank. */}
          <Segmented
            value={String(rank) as '1' | '2'}
            onChange={(v) => setRank(Number(v) as 1 | 2)}
            options={[
              { value: '1', label: `1등 ${countFor(1, active)}곳` },
              { value: '2', label: `2등 ${countFor(2, active)}곳` },
            ]}
          />
          {regions.length > 1 && (
            <Chips
              scroll
              value={active}
              onChange={setRegion}
              options={[
                { value: ALL, label: `${ALL} ${countFor(rank, ALL)}` },
                ...regions.map(([r]) => ({ value: r, label: `${r} ${countFor(rank, r)}` })),
              ]}
            />
          )}
        </>
      )}
      <Card style={styles.card}>
        {state.status === 'loading' && (
          <ThemedText type="small" themeColor="textTertiary" style={styles.message}>
            불러오는 중…
          </ThemedText>
        )}
        {state.status === 'error' && (
          <ThemedText type="small" themeColor="textTertiary" style={styles.message}>
            판매점 정보를 불러오지 못했어요.
          </ThemedText>
        )}
        {state.status === 'done' &&
          (shown.length > 0 ? (
            <TicketList tickets={shown} />
          ) : (
            <ThemedText type="small" themeColor="textTertiary" style={styles.message}>
              {emptyMessage}
            </ThemedText>
          ))}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 12, gap: 0 },
  line: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', paddingVertical: 12 },
  flex: { flex: 1, gap: 2 },
  shrink: { flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  message: { paddingVertical: 12 },
});
