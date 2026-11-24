import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ThiefCharacter from './ThiefCharacter';

export interface ElfRunSpec {
  id: number;
  fromPlayer: number;
  toPlayer: number;
  label: string;
  duration: number;
}

const ELF_SIZE = 96;

function centerOf(playerId: number) {
  // Cartonașele jucătorilor sunt marcate cu data-dirty-player, și pe ecranul mare, și pe telefon.
  const el = document.querySelector<HTMLElement>(`[data-dirty-player="${playerId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight || rect.width === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Elful Hoț ia cadoul de la cartonașul păgubitului și fuge pe vârfuri, pe un arc,
 * până la cartonașul hoțului. Dacă un cartonaș nu se vede pe ecran (de exemplu,
 * pe telefon, mai jos în listă), elful intră sau iese prin marginea ecranului.
 */
export default function ElfRun({ run, onDone }: { run: ElfRunSpec; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const midY = window.innerHeight * 0.45;
    const from = centerOf(run.fromPlayer) ?? { x: -ELF_SIZE, y: midY };
    const to = centerOf(run.toPlayer) ?? { x: window.innerWidth + ELF_SIZE, y: midY };
    // Elful e desenat alergând spre dreapta; spre stânga întoarcem doar desenul, nu și eticheta.
    const flip = to.x < from.x ? -1 : 1;
    el.style.setProperty('--dirty-flip', String(flip));
    const lift = Math.min(220, 80 + Math.hypot(to.x - from.x, to.y - from.y) * 0.25);
    const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };

    const steps = 16;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * control.x + t ** 2 * to.x;
      const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control.y + t ** 2 * to.y;
      // Pași pe vârfuri: un mic salt și o legănare la fiecare cadru.
      const hop = i % 2 === 0 ? 0 : -10;
      const tilt = i % 2 === 0 ? -6 : 6;
      const appear = i === 0 ? 0 : i === steps ? 0 : 1;
      const scale = i === 0 || i === steps ? 0.4 : 1;
      frames.push({
        transform: `translate(${x - ELF_SIZE / 2}px, ${y - ELF_SIZE / 2 + hop}px) scale(${scale}) rotate(${tilt * flip}deg)`,
        opacity: appear,
        offset: t,
      });
    }
    // Apare și dispare puțin mai lin decât restul drumului.
    frames[1].opacity = 1;
    const animation = el.animate(frames, { duration: run.duration, easing: 'linear', fill: 'forwards' });
    animation.onfinish = () => done.current();
    return () => animation.cancel();
  }, [run]);

  return createPortal(
    <div ref={ref} className="dirty-elf-run" aria-hidden="true" style={{ width: ELF_SIZE, height: ELF_SIZE }}>
      <ThiefCharacter role="elf" size={ELF_SIZE} className="dirty-elf-run__elf" />
      <span className="dirty-elf-run__gift">{run.label}</span>
    </div>,
    // În modul ecran complet se vede doar elementul din fullscreen.
    document.fullscreenElement ?? document.body,
  );
}
