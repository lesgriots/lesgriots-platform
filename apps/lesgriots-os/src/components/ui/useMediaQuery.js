'use client';
/**
 * useMediaQuery — hook matchMedia SSR-safe.
 * Retourne false côté serveur / avant hydratation, puis la valeur réelle.
 * Usage : const isMobile = useMediaQuery('(max-width: 767px)');
 */
import { useCallback, useSyncExternalStore } from 'react';

export default function useMediaQuery(query) {
  const subscribe = useCallback((callback) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mql = window.matchMedia(query);
    // addEventListener supporté partout où l'OS tourne (navigateurs modernes)
    mql.addEventListener('change', callback);
    return () => mql.removeEventListener('change', callback);
  }, [query]);

  const getSnapshot = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
