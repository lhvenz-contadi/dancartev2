import type { ReactNode, KeyboardEventHandler } from 'react';
import { cn } from '../../lib/utils';

export type ListCardStatus = 'success' | 'warning' | 'danger' | 'neutral';

const statusBorder: Record<ListCardStatus, string> = {
  success: 'border-l-green-400',
  warning: 'border-l-amber-400',
  danger: 'border-l-red-400',
  neutral: 'border-l-slate-200',
};

interface ListCardProps {
  avatar?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
  status?: ListCardStatus;
  className?: string;
}

export const ListCard = ({
  avatar,
  title,
  subtitle,
  meta,
  onClick,
  status,
  className,
}: ListCardProps) => {
  const onKey: KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onKey}
      className={cn(
        'min-h-16 p-3 rounded-lg border border-slate-100 bg-white',
        'flex items-center gap-3 transition-colors',
        status && 'border-l-4',
        status && statusBorder[status],
        onClick && 'cursor-pointer hover:bg-slate-50 active:bg-slate-100',
        onClick && 'focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50',
        className,
      )}
    >
      {avatar && (
        <div className="w-12 h-12 shrink-0 flex items-center justify-center">
          {avatar}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary truncate">{title}</p>
        {subtitle && (
          <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
        )}
      </div>
      {meta && (
        <div className="shrink-0 flex flex-col items-end gap-1">
          {meta}
        </div>
      )}
    </div>
  );
};
