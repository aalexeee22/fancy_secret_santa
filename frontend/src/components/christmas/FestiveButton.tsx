import { Button, type ButtonProps } from 'antd';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

type Tone = 'red' | 'light' | 'ghost' | 'gold' | 'green';

function classes(tone: Tone, block?: boolean, small?: boolean, extra?: string) {
  return ['festive-btn', `festive-btn--${tone}`, block && 'festive-btn--block', small && 'festive-btn--small', extra]
    .filter(Boolean)
    .join(' ');
}

function Content({ children, gift }: { children: ReactNode; gift?: ReactNode }) {
  return (
    <>
      <span className="festive-btn__label">
        {gift && <span className="festive-btn__gift" aria-hidden="true">{gift}</span>}
        {children}
      </span>
      <span className="festive-btn__shine" aria-hidden="true" />
    </>
  );
}

interface FestiveButtonProps extends Omit<ButtonProps, 'type'> {
  tone?: Tone;
  /** emoji (sau personaj) mic care tresare la hover, înaintea textului */
  gift?: ReactNode;
  small?: boolean;
}

/** Buton Ant Design cu lift, glow auriu și shine la hover. */
export default function FestiveButton({ tone = 'red', gift, small, block, className, children, ...rest }: FestiveButtonProps) {
  return (
    <Button {...rest} className={classes(tone, block, small, className)}>
      <Content gift={gift}>{children}</Content>
    </Button>
  );
}

interface FestiveLinkProps {
  to: string;
  tone?: Tone;
  gift?: ReactNode;
  small?: boolean;
  block?: boolean;
  className?: string;
  children: ReactNode;
}

/** Același stil, dar ca link de router (navigare fără reîncărcarea paginii). */
export function FestiveLink({ to, tone = 'red', gift, small, block, className, children }: FestiveLinkProps) {
  return (
    <Link to={to} className={classes(tone, block, small, className)}>
      <Content gift={gift}>{children}</Content>
    </Link>
  );
}
