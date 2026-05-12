import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxHeight?: string;
  className?: string;
}

export const BottomSheet = ({
  open,
  onClose,
  title,
  children,
  maxHeight = '85dvh',
  className,
}: BottomSheetProps) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bs-backdrop"
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="bs-panel"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col',
              className,
            )}
            style={{
              maxHeight,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            {title && (
              <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-slate-100 shrink-0">
                <h3 className="text-base font-bold text-primary">{title}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            <div className="overflow-y-auto px-5 py-4 flex-1">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
