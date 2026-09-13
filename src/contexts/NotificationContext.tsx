 import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface NotificationContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showError: (error: any) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    // Prevent duplicate identical toasts within 3 seconds
    setToasts((prev) => {
      const duplicate = prev.find((t) => t.message === message && t.type === type);
      if (duplicate) return prev;
      const id = Math.random().toString(36).substring(2, 9);
      const newToasts = [...prev, { id, message, type }];
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 3500);
      return newToasts;
    });
  }, []);

  // رسائل الـ backend قد تختلف بين API وأخرى؛ لا نعرض أي نص تقني/إنجليزي للمستخدم.
  const translateError = (rawMsg: string): string => {
    const message = String(rawMsg || '').trim();
    if (!message) return 'تعذّر تنفيذ العملية، حاول مرة أخرى';

    // الرسائل العربية الواضحة القادمة من الخادم صالحة للعرض كما هي.
    if (/[\u0600-\u06FF]/.test(message)) return message;

    const normalized = message.toLowerCase();
    const matches = (terms: string[]) => terms.some((term) => normalized.includes(term));

    if (matches(['failed to fetch', 'networkerror', 'network request failed', 'load failed', 'econnrefused'])) {
      return 'تعذّر الاتصال بالخادم. تأكد من الإنترنت ثم حاول مرة أخرى';
    }
    if (matches(['unauthorized', 'invalid token', 'token expired', 'jwt expired', 'authentication'])) {
      return 'انتهت صلاحية الجلسة. سجّل الدخول من جديد';
    }
    if (matches(['forbidden', 'permission denied', 'access denied'])) {
      return 'لا تملك صلاحية تنفيذ هذا الإجراء';
    }
    if (matches(['not found', 'does not exist', 'no such'])) {
      return 'العنصر المطلوب غير موجود أو تم حذفه';
    }
    if (matches(['already exists', 'duplicate key', 'duplicate', 'unique constraint'])) {
      return 'هذه البيانات مسجلة بالفعل. راجع المدخلات وحاول مرة أخرى';
    }
    if (matches(['validation', 'required', 'invalid', 'cast to objectid', 'malformed'])) {
      return 'البيانات المدخلة غير مكتملة أو غير صحيحة';
    }
    if (matches(['too large', 'payload', 'file size', 'entity too large'])) {
      return 'حجم الملف أو الطلب أكبر من المسموح. استخدم ملفًا أصغر ثم حاول مرة أخرى';
    }
    if (matches(['timeout', 'timed out', 'gateway'])) {
      return 'الخادم استغرق وقتًا أطول من المتوقع. حاول مرة أخرى';
    }
    if (matches(['internal server', 'server error', 'database', 'mongo', 'sql'])) {
      return 'حدث خطأ في الخادم. حاول مرة أخرى بعد قليل';
    }

    return 'تعذّر تنفيذ العملية. حاول مرة أخرى، وإذا تكررت المشكلة تواصل مع المسؤول';
  };

  const showError = useCallback((error: any) => {
    let msg = 'حدث خطأ غير متوقع، يرجى المحاولة مجدداً';
    if (typeof error === 'string') {
      msg = translateError(error);
    } else if (error?.details && Array.isArray(error.details) && error.details.length > 0) {
      msg = error.details.map((d: string) => translateError(d)).join('، ');
    } else if (error?.message) {
      msg = translateError(error.message);
    } else if (error?.error) {
      msg = translateError(error.error);
    }
    showToast(msg, 'error');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  return (
    <NotificationContext.Provider value={{ showToast, showError }}>
      {children}
      
      {/* Right Toast Container (all notifications on the right side for RTL) */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none text-right font-sans">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl shadow-lg border text-xs font-bold transition-all duration-200 animate-in slide-in-from-right-3 fade-in ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-blue-50 border-blue-300 text-blue-950'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-[#2e5b9f] shrink-0 mt-0.5" />}
            <div className="flex-1 leading-snug">{toast.message}</div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
