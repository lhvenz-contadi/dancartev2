import type { ReactNode, MouseEventHandler } from 'react';
import { cn } from '../../lib/utils';

interface FABProps {
  icon: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  label: string;
  hideOnDesktop?: boolean;
  className?: string;
}

export const FAB = ({ icon, onClick, label, hideOnDesktop = true, className }: FABProps) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={cn(
      'fixed right-4 z-20 w-14 h-14 rounded-full bg-primary text-white',
      'flex items-center justify-center shadow-lg shadow-primary/30',
      'active:scale-95 transition-transform',
      hideOnDesktop && 'md:hidden',
      className,
    )}
    style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
  >
    {icon}
  </button>
);
