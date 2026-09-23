import React, { useState, useEffect } from 'react';
import { Printer, X, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  getConfiguredCashierPrinters,
  setConfiguredCashierPrinters,
  CashierPrinterInfo,
} from '../../utils/printerConfig';
import { useNotification } from '../../contexts/NotificationContext';

interface CashierPrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashierPrinterSettingsModal: React.FC<CashierPrinterSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { showToast } = useNotification();
  const isElectron = !!(window as any).electronAPI?.isElectron;

  const [availablePrinters, setAvailablePrinters] = useState<CashierPrinterInfo[]>([]);
  const [configuredPrinters, setConfiguredPrinters] = useState<string[]>(() =>
    getConfiguredCashierPrinters()
  );
  const [isLoading, setIsLoading] = useState(false);

  const fetchPrinters = async () => {
    if (!isElectron || !(window as any).electronAPI?.getPrinters) return;
    setIsLoading(true);
    try {
      const res = await (window as any).electronAPI.getPrinters();
      if (res?.ok && Array.isArray(res.printers)) {
        setAvailablePrinters(res.printers);
        const currentSaved = getConfiguredCashierPrinters();
        if (currentSaved.length === 0) {
          const def = res.printers.find((p: any) => p.isDefault);
          if (def?.name) {
            const initial = [def.name];
            setConfiguredPrinters(initial);
            setConfiguredCashierPrinters(initial);
          }
        } else {
          setConfiguredPrinters(currentSaved);
        }
      } else {
        showToast('تعذّر قراءة الطابعات من نظام التشغيل', 'error');
      }
    } catch (err: any) {
      console.error('[PrinterSettingsModal] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPrinters();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const togglePrinter = (printerName: string) => {
    const isSelected = configuredPrinters.includes(printerName);
    const updated = isSelected
      ? configuredPrinters.filter((p) => p !== printerName)
      : [...configuredPrinters, printerName];
    setConfiguredPrinters(updated);
    setConfiguredCashierPrinters(updated);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex justify-center items-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs font-sans">
      <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-l from-[#1e3a8a] via-[#2e5b9f] to-[#3f6db3] p-5 text-white flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div>
              <h3 className="font-bold text-base font-arabic-heading">إعدادات طابعات الكاشير</h3>
              <p className="text-[11px] text-blue-100 opacity-80">تحديد طابعات الفواتير لهذا الجهاز</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={fetchPrinters}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2e5b9f] hover:underline cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>إعادة فحص الطابعات</span>
            </button>
            <span className="text-xs text-gray-500 font-bold">
              الطابعات المحددة: <strong className="text-[#2e5b9f] font-mono text-sm">{configuredPrinters.length}</strong>
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {availablePrinters.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                {isLoading ? 'جاري فحص الطابعات المتاحة على Windows…' : 'لم يتم العثور على أي طابعات مثبتة.'}
              </div>
            ) : (
              availablePrinters.map((p, idx) => {
                const isConfigured = configuredPrinters.includes(p.name);
                const isOnline = p.status === 0 || p.status === undefined;
                return (
                  <div
                    key={p.name}
                    onClick={() => togglePrinter(p.name)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isConfigured
                        ? 'border-[#2e5b9f] bg-blue-50/50 ring-1 ring-[#2e5b9f]/20'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isConfigured}
                        onChange={() => {}}
                        className="w-4 h-4 text-[#2e5b9f] rounded cursor-pointer pointer-events-none"
                      />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {isOnline ? 'متصلة' : 'غير متصلة/مشغولة'}
                      </span>
                    </div>

                    <div className="text-right flex-1 min-w-0">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.isDefault && (
                          <span className="text-[9px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            افتراضية
                          </span>
                        )}
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {idx + 1}. {p.displayName || p.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono block truncate">
                        {p.name}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-[11px] text-blue-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2e5b9f] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              عند الضغط على "طباعة الفاتورة"، تُرسل الفاتورة مباشرة لجميع الطابعات المحددة أعلاه بدون ظهور أي Dialog. لن تُرسل الفاتورة لأي طابعة غير محددة (مثل OneNote أو Microsoft PDF).
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                showToast(`تم حفظ وتأكيد ${configuredPrinters.length} طابعة كاشير لهذا الجهاز`, 'success');
                onClose();
              }}
              className="w-full py-3 bg-[#2e5b9f] hover:bg-[#244b85] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-xs"
            >
              حفظ واعتماد الطابعات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
