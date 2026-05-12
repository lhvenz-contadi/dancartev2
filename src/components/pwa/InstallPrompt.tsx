import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DAYS = 7;

const wasRecentlyDismissed = (): boolean => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const markDismissed = () => {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
};

const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari
  // @ts-ignore - non-standard
  if (window.navigator.standalone === true) return true;
  return false;
};

const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  // @ts-ignore - MSStream check is for old IE/Edge
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSBanner, setShowIOSBanner] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (isIOS()) {
      setShowIOSBanner(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    markDismissed();
    setDeferredPrompt(null);
    setShowIOSBanner(false);
  };

  const visible = !!deferredPrompt || showIOSBanner;
  const isIOSMode = !deferredPrompt && showIOSBanner;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="md:hidden fixed left-3 right-3 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
          role="dialog"
          aria-label="Instalar aplicativo"
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                <Download size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary">
                  Adicionar DancArte à tela inicial?
                </p>
                {isIOSMode ? (
                  <p className="text-xs text-slate-600 mt-1 flex items-center gap-1 flex-wrap">
                    Toque em <Share size={14} className="inline" /> e depois em
                    <span className="font-medium">"Adicionar à Tela de Início"</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-600 mt-1">
                    Acesse mais rápido, direto da sua tela inicial.
                  </p>
                )}
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 -mt-1 -mr-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            {!isIOSMode && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleDismiss}
                  className="flex-1 min-h-10 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Agora não
                </button>
                <button
                  onClick={handleInstall}
                  className="flex-1 min-h-10 px-3 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Instalar
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
