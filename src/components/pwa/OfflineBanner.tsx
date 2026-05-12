import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineBanner = () => {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setShowRestored(true);
      const t = setTimeout(() => setShowRestored(false), 2000);
      return () => clearTimeout(t);
    };
    const handleOffline = () => {
      setOnline(false);
      setShowRestored(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const visible = !online || showRestored;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className={`fixed top-0 left-0 right-0 z-40 ${
            online ? 'bg-emerald-600' : 'bg-amber-500'
          } text-white shadow-md`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
          role="status"
          aria-live="polite"
        >
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2 text-sm">
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span className="font-medium">
              {online
                ? 'Conexão restaurada'
                : 'Você está offline. Algumas funções podem não funcionar.'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
