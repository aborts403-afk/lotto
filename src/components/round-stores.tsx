import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Collapsible } from '@/components/ui/collapsible';
import { Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import type { WinningTicket } from '@/lib/lotto/stores';
import { SITE_URL } from '@/lib/site';

export const FIRST_ROUND_WITH_STORES = 262;

type State = { round: number } & ({ status: 'error' } | { status: 'done'; tickets: WinningTicket[] });

function TicketLine({ t }: { t: WinningTicket }) {
  return (
    <View style={styles.line}>
      <View style={styles.flex}>
        <ThemedText type="small">
          {t.isInternet ? '인터넷 (동행복권)' : (t.storeName ?? '-')}
          {t.status === '폐점' ? <ThemedText type="small" themeColor="textSecondary">  폐점</ThemedText> : null}
        </ThemedText>
        {!t.isInternet && t.address?.trim() ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.address}>
            {t.address.trim()}
          </ThemedText>
        ) : null}
      </View>
      {t.pickType && (
        <ThemedText type="small" themeColor="textSecondary">
          {t.pickType}
        </ThemedText>
      )}
    </View>
  );
}

// 1st- and 2nd-prize winning stores of a round, loaded from the API (not bundled: ~60 rows per round).
export function RoundStores({ round, firstWinners }: { round: number; firstWinners: number }) {
  const hydrated = useHydrated();
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
    <Card>
      <ThemedText type="smallBold">당첨 판매점</ThemedText>
      {state.status === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          불러오는 중…
        </ThemedText>
      )}
      {state.status === 'error' && (
        <ThemedText type="small" themeColor="textSecondary">
          판매점 정보를 불러오지 못했어요.
        </ThemedText>
      )}
      {state.status === 'done' && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            1등 {first.length}곳{firstWinners === 0 ? ' (1등 없음)' : ''}
          </ThemedText>
          {first.length === 0 && firstWinners > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              아직 판매점 정보가 올라오지 않았어요. 보통 추첨 다음 날까지 나와요.
            </ThemedText>
          ) : (
            first.map((t) => <TicketLine key={`1-${t.seq}`} t={t} />)
          )}
          {second.length > 0 && (
            <Collapsible title={`2등 판매점 ${second.length}곳 보기`}>
              <View style={styles.list}>
                {second.map((t) => (
                  <TicketLine key={`2-${t.seq}`} t={t} />
                ))}
              </View>
            </Collapsible>
          )}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start', paddingVertical: 4 },
  flex: { flex: 1 },
  address: { fontSize: 12, lineHeight: 16 },
  list: { gap: 2 },
});
