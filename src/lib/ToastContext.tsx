import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string, duration?: number) => string;
    error: (message: string, title?: string, duration?: number) => string;
    warning: (message: string, title?: string, duration?: number) => string;
    info: (message: string, title?: string, duration?: number) => string;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Standalone global emitter for usage outside React components if needed
type ToastListener = (toast: ToastItem) => void;
const standaloneListeners = new Set<ToastListener>();

export const triggerGlobalToast = (type: ToastType, message: string, title?: string, duration?: number): string => {
  const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const item: ToastItem = { id, type, message, title, duration: duration ?? 4000 };
  standaloneListeners.forEach(fn => fn(item));
  return id;
};

export const globalToast = {
  success: (message: string, title?: string, duration?: number) => triggerGlobalToast('success', message, title, duration),
  error: (message: string, title?: string, duration?: number) => triggerGlobalToast('error', message, title, duration),
  warning: (message: string, title?: string, duration?: number) => triggerGlobalToast('warning', message, title, duration),
  info: (message: string, title?: string, duration?: number) => triggerGlobalToast('info', message, title, duration)
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, title?: string, duration: number = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newItem: ToastItem = { id, type, message, title, duration };

    setToasts(prev => {
      // Prevent exact duplicate flood within 1 second
      const existing = prev.find(t => t.type === type && t.message === message);
      if (existing) return prev;
      return [...prev.slice(-4), newItem]; // Keep maximum 5 active
    });

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }

    return id;
  }, [dismissToast]);

  React.useEffect(() => {
    const handleStandalone: ToastListener = (item) => {
      setToasts(prev => {
        const existing = prev.find(t => t.type === item.type && t.message === item.message);
        if (existing) return prev;
        return [...prev.slice(-4), item];
      });
      if (item.duration && item.duration > 0) {
        setTimeout(() => {
          dismissToast(item.id);
        }, item.duration);
      }
    };

    standaloneListeners.add(handleStandalone);
    return () => {
      standaloneListeners.delete(handleStandalone);
    };
  }, [dismissToast]);

  const toastMethods = React.useMemo(() => ({
    success: (msg: string, title?: string, dur?: number) => showToast('success', msg, title, dur),
    error: (msg: string, title?: string, dur?: number) => showToast('error', msg, title, dur),
    warning: (msg: string, title?: string, dur?: number) => showToast('warning', msg, title, dur),
    info: (msg: string, title?: string, dur?: number) => showToast('info', msg, title, dur)
  }), [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, toast: toastMethods }}>
      {children}
      {/* Toast Notification Container */}
      <div 
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';
          const isInfo = t.type === 'info';

          return (
            <div
              key={t.id}
              role={isError ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-bottom-2 ${
                isSuccess
                  ? 'bg-zinc-900/95 border-emerald-500/30 text-zinc-100 shadow-emerald-950/20'
                  : isError
                  ? 'bg-zinc-900/95 border-rose-500/30 text-zinc-100 shadow-rose-950/20'
                  : isWarning
                  ? 'bg-zinc-900/95 border-amber-500/30 text-zinc-100 shadow-amber-950/20'
                  : 'bg-zinc-900/95 border-violet-500/30 text-zinc-100 shadow-violet-950/20'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                {isError && <AlertCircle className="h-5 w-5 text-rose-400" />}
                {isWarning && <AlertTriangle className="h-5 w-5 text-amber-400" />}
                {isInfo && <Info className="h-5 w-5 text-violet-400" />}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                {t.title && (
                  <h5 className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${
                    isSuccess ? 'text-emerald-400' : isError ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-violet-400'
                  }`}>
                    {t.title}
                  </h5>
                )}
                <p className="text-xs text-zinc-300 font-sans leading-relaxed break-words">
                  {t.message}
                </p>
              </div>

              <button
                onClick={() => dismissToast(t.id)}
                className="shrink-0 p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
