import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

// Tickets the user saved ("내 번호"). Stored only on this device (AsyncStorage; localStorage on web).

export type TicketSource = 'generate' | 'manual' | 'qr';

export type MyTicket = {
  id: string;
  round: number; // the draw this ticket is for
  numbers: number[]; // 6 sorted
  source: TicketSource;
  createdAt: string; // ISO
};

const KEY = 'my-tickets-v1';
const MAX_TICKETS = 2000;

let tickets: readonly MyTicket[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function isTicket(t: unknown): t is MyTicket {
  const x = t as MyTicket;
  return (
    !!x &&
    typeof x.id === 'string' &&
    Number.isInteger(x.round) &&
    Array.isArray(x.numbers) &&
    x.numbers.length === 6 &&
    x.numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 45)
  );
}

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      tickets = Array.isArray(parsed) ? parsed.filter(isTicket) : [];
    })
    .catch(() => {
      tickets = [];
    })
    .finally(() => {
      loaded = true;
      emit();
    });
  return loading;
}

async function persist(next: readonly MyTicket[]) {
  tickets = next;
  emit();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (e.g. a private browser window): keep the in-memory list for this session.
  }
}

const sameNumbers = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

/** Adds tickets, skipping ones already saved for the same round. Returns how many were added. */
export async function addTickets(round: number, sets: readonly (readonly number[])[], source: TicketSource): Promise<number> {
  await load();
  const now = new Date().toISOString();
  const added: MyTicket[] = [];
  for (const s of sets) {
    const numbers = [...s].sort((a, b) => a - b);
    const exists = [...tickets, ...added].some((t) => t.round === round && sameNumbers(t.numbers, numbers));
    if (!exists) {
      added.push({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        round,
        numbers,
        source,
        createdAt: now,
      });
    }
  }
  if (added.length) await persist([...added, ...tickets].slice(0, MAX_TICKETS));
  return added.length;
}

export async function removeTickets(ids: readonly string[]): Promise<void> {
  await load();
  const drop = new Set(ids);
  await persist(tickets.filter((t) => !drop.has(t.id)));
}

/** Puts back tickets removed by removeTickets (undo). */
export async function restoreTickets(removed: readonly MyTicket[]): Promise<void> {
  await load();
  const ids = new Set(tickets.map((t) => t.id));
  const back = removed.filter((t) => !ids.has(t.id));
  if (back.length) await persist([...tickets, ...back].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => tickets;
const getLoaded = () => loaded;
const getServer = (): readonly MyTicket[] => [];
const getServerLoaded = () => false;

/** Saved tickets, newest first. `loaded` is false until storage has been read (and always during web static rendering). */
export function useMyTickets(): { tickets: readonly MyTicket[]; loaded: boolean } {
  useEffect(() => {
    void load();
  }, []);
  return {
    tickets: useSyncExternalStore(subscribe, getSnapshot, getServer),
    loaded: useSyncExternalStore(subscribe, getLoaded, getServerLoaded),
  };
}
