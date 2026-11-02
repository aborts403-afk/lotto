import { useEffect, useState } from 'react';

/** A short status message that clears itself. */
export function useToast(ms = 2500): [string | null, (message: string) => void] {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast, ms]);
  return [toast, setToast];
}
