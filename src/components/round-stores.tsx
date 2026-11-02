import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Pill, Section } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Collapsible } from '@/components/ui/collapsible';
import { Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useTheme } from '@/hooks/use-theme';
import type { WinningTicket } from '@/lib/lotto/stores';
import { SITE_URL } from '@/lib/site';

export const FIRST_ROUND_WITH_STORES = 262;

type State = { round: number } & ({ status: 'error' } | { status: 'done'; tickets: WinningTicket[] });

function TicketLine({ t, last }: { t: WinningTicket; last: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.line, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
      <View style={styles.flex}>
        <ThemedText type="smallBold">
          {t.isInternet ? '인터넷 (동행복권)' : (t.storeName ?? '-')}
          {t.status === '폐점' ? (
            <ThemedText type="caption" themeColor="textTertiary">
              {'  '}폐점
            </ThemedText>
          ) : null}
        </ThemedText>
        {!t.isInternet && t.address?.trim() ? (
          <ThemedText type="caption" themeColor="textTertiary">
            {t.address.trim()}
          </ThemedText>
        ) : null}
      </View>
      {t.pickType && <Pill label={t.pickType} color={t.pickType === '자동' ? theme.primary : theme.warning} soft />}
    </View>
  );
}

// 1st- and 2nd-prize winning stores of a round, loaded from the API (not bundled: ~60 rows per round).
export function RoundStores({ round, firstWinners }: { round: number; firstWinners: number }) {
  const hydrated = useHydrated();
  const theme = useTheme();
  // Result for the round it was loaded for; anything else (first render, round changed) is "loading".
  const [loaded, setLoaded] = useState<State | null>(null);
  const state = loaded?.round === round ? loaded : { status: 'loading' as const };

  useEffect(() => {
    if (!hydrated || round < FIRST_ROUND_WITH_STORES) return;
    let cancelled = false;
    fetch(`${SITE_URL}/api/draws/${round}/stores`)
      .then((res) => (res.ok ? (res.json() as Promise<WinningTicket[]>) : Promise.reject(new Error(String(res.status)))))
      .then((tickets) => !cancelled && setLoaded({ round, status: 'done', tickets }))
      .catch(() => !cancelled && setLoaded({ round, status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [hydrated, round]);

  if (round < FIRST_ROUND_WITH_STORES) return null;

  const first = state.status === 'done' ? state.tickets.filter((t) => t.rank === 1) : [];
  const second = state.status === 'done' ? state.tickets.filter((t) => t.rank === 2) : [];

  return (
    <Section
      title="당첨 판매점"
      description={state.status === 'done' ? `1등 ${first.length}곳 · 2등 ${second.length}곳` : undefined}>
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
          (first.length === 0 ? (
            <ThemedText type="small" themeColor="textTertiary" style={styles.message}>
              {firstWinners === 0
                ? '이 회차는 1등이 없었어요.'
                : '아직 판매점 정보가 올라오지 않았어요. 보통 추첨 다음 날까지 나와요.'}
            </ThemedText>
          ) : (
            <View>
              {first.map((t, i) => (
                <TicketLine key={`1-${t.seq}`} t={t} last={i === first.length - 1} />
              ))}
            </View>
          ))}
        {state.status === 'done' && second.length > 0 && (
          <View style={[styles.second, { borderColor: theme.border }]}>
            <Collapsible title={`2등 판매점 ${second.length}곳`}>
              <View>
                {second.map((t, i) => (
                  <TicketLine key={`2-${t.seq}`} t={t} last={i === second.length - 1} />
                ))}
              </View>
            </Collapsible>
          </View>
        )}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 8, gap: 0 },
  line: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', paddingVertical: 12 },
  flex: { flex: 1, gap: 2 },
  message: { paddingVertical: 12 },
  second: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 4 },
});
