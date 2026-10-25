import { useMediaQuery } from './useMediaQuery';

/** true când utilizatorul a cerut din sistem mai puține animații. */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
