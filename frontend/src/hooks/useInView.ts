import { useEffect, useRef, useState } from 'react';

/** Devine true când elementul intră în ecran (o singură dată, implicit). */
export function useInView<T extends Element>({ threshold = 0.14, once = true } = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const supported = typeof IntersectionObserver !== 'undefined';

  useEffect(() => {
    const node = ref.current;
    if (!node || !supported) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        if (once) observer.disconnect();
      } else if (!once) {
        setInView(false);
      }
    }, { threshold });
    observer.observe(node);

    // Plasă de siguranță: unele browsere amână notificarea inițială (ex. fereastră
    // acoperită). Dacă elementul e deja pe ecran, îl arătăm oricum.
    const fallback = window.setTimeout(() => {
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) setInView(true);
    }, 300);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [threshold, once, supported]);

  // Fără IntersectionObserver (browsere foarte vechi), arătăm direct conținutul.
  return { ref, inView: inView || !supported };
}
