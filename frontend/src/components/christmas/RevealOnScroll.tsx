import type { CSSProperties, ReactNode } from 'react';
import { useInView } from '../../hooks/useInView';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface RevealOnScrollProps {
  children: ReactNode | ((visible: boolean) => ReactNode);
  /** întârziere în ms, pentru apariții în cascadă */
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

/** Fade + translateY când elementul intră în ecran. Copiii pot primi și starea `visible`. */
export default function RevealOnScroll({ children, delay = 0, className, style }: RevealOnScrollProps) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const visible = inView || reduced;

  return (
    <div
      ref={ref}
      className={`xmas-reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={{ ...style, transitionDelay: `${delay}ms` }}
    >
      {typeof children === 'function' ? children(visible) : children}
    </div>
  );
}
