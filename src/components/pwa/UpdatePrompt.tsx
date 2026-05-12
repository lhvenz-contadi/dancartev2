import { AnimatePresence, motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const UpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed top-0 left-0 right-0 z-[60] bg-primary text-white shadow-lg"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
          role="status"
          aria-live="polite"
        >
          <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <RefreshCw size={18} className="shrink-0" />
              <p className="text-sm font-medium">Nova versão disponível</p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setNeedRefresh(false)}
                className="flex-1 sm:flex-none min-h-10 px-4 text-sm font-medium text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                Depois
              </button>
              <button
                onClick={() => updateServiceWorker(true)}
                className="flex-1 sm:flex-none min-h-10 px-4 text-sm font-semibold bg-white text-primary rounded-lg hover:bg-white/90 transition-colors"
              >
                Atualizar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
