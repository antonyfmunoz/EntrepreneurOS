import { useCallback, useEffect, useState } from 'react';

/**
 * useRailCollapse — localStorage-backed boolean state for collapsible
 * layout rails (left nav, right AI chat). Keyed so multiple rails can
 * share the hook without colliding. Persists across navigations, tabs,
 * and page reloads.
 */
export function useRailCollapse(key: string, defaultCollapsed = false) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultCollapsed;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return defaultCollapsed;
      return stored === '1';
    } catch {
      return defaultCollapsed;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, collapsed ? '1' : '0');
    } catch {
      // Swallow quota / private-mode errors — UI state is non-critical.
    }
  }, [key, collapsed]);

  const toggle = useCallback(() => setCollapsedState((prev) => !prev), []);
  const setCollapsed = useCallback((next: boolean) => setCollapsedState(next), []);

  return { collapsed, toggle, setCollapsed };
}
