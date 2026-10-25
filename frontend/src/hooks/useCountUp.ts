import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** Numără de la 0 la `target` cu ease-out, doar după ce `start` devine true. */
export function useCountUp(target: number, start: boolean, duration = 1100): number {
  const reduced = useReducedMotion();
  const animate = start && !reduced && target !== 0;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, animate, duration]);

  if (!start) return 0;
  return animate ? value : target;
}
