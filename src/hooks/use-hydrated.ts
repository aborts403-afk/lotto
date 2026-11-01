import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * false during web static rendering and hydration, true afterwards (and always true on native).
 * Use it to defer client-only values (random numbers, color scheme) and avoid hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
