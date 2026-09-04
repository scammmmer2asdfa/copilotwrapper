import { useEffect } from 'react';

/** Calls `onEscape` when Escape is pressed while this component is mounted/active. */
export function useEscapeKey(onEscape: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onEscape, active]);
}
