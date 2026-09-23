import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User, Printer, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  getConfiguredCashierPrinters,
  setConfiguredCashierPrinters,
  CashierPrinterInfo,
} from '../../utils/printerConfig';

export const AdminSettingsPage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { showToast } = useNotification();

  const isElectron = !!(window as any).electronAPI?.isElectron;

  const [userName, setUserName] = useState(user?.userName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileErrors, setProfileErrors] = useState<{ userName?: string }>({});

  // 🖨️ حالة إعدادات طابعات الكاشير
  const [availablePrinters, setAvailablePrinters] = useState<CashierPrinterInfo[]>([]);
  const [configuredPrinters, setConfiguredPrinters] = useState<string[]>(() =>
    getConfiguredCashierPrinters()
  );
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);

  const fetchPrinters = async () => {
    if (!isElectron || !(window as any).electronAPI?.getPrinters) return;
    setIsLoadingPrinters(true);
    try {
      const res = await (window as any).electronAPI.getPrinters();
      if (res?.ok && Array.isArray(res.printers)) {
        setAvailablePrinters(res.printers);
        // لو مفيش أي طابعة مخصصة حالياً ومفيش إعداد سابق، حدد الافتراضية كبداية
        const currentSaved = getConfiguredCashierPrinters();
        if (currentSaved.length === 0) {
          const def = res.printers.find((p: any) => p.isDefault);
          if (def?.name) {
            const initial = [def.name];
            setConfiguredPrinters(initial);
            setConfiguredCashierPrinters(initial);
          }
        }
      } else {
        showToast('تعذّر قراءة الطابعات من نظام التشغيل', 'error');
      }
    } catch (err: any) {
      console.error('[AdminSettings] Failed to fetch printers:', err);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, [isElectron]);

  const togglePrinter = (printerName: string) => {
    const isSelected = configuredPrinters.includes(printerName);
    const updated = isSelected
      ? configuredPrinters.filter((p) => p !== printerName)
      : [...configuredPrinters, printerName];
    setConfiguredPrinters(updated);
    setConfiguredCashierPrinters(updated);
    showToast(
      isSelected ? `تمت إزالة ${printerName} من طابعات الكاشير` : `تمت إضافة ${printerName} إلى طابعات الكاشير المخصصة`,
      'success'
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { userName?: string } = {};

    if (!userName.trim()) {
      errors.userName = 'الاسم الكامل مطلوب';
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      showToast('الرجاء تصحيح الحقول المميزة باللون الأحمر', 'error');
      return;
    }

    setProfileErrors({});
    setIsUpdating(true);
    // ✅ نرسل الاسم فقط — حقول الهاتف والعنوان غير مفعلة حالياً في هذه الشاشة
    const success = await updateProfile({ userName });
    setIsUpdating(false);
    if (success) {
      showToast('تم حفظ بيانات الملف الشخصي بنجاح');
    }
  };

  return (
    <div className="space-y-8 text-right max-w-4xl font-sans">
      {/* Top Header */}
      <div className="pb-2 border-b border-gray-200/60">
        <h1 className="text-2xl font-bold font-arabic-heading text-gray-900">
          إعدادات النظام والملف الشخصي
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          إدارة بيانات الحساب الشخصي وطابعات الكاشير المخصصة لجهاز الـ Desktop.
        </p>
      </div>

      {/* 🖨️ Desktop Printer Settings Card */}
      {isElectron && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
            <button
              type="button"
              onClick={fetchPrinters}
              disabled={isLoadingPrinters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#2e5b9f] bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPrinters ? 'animate-spin' : ''}`} />
              <span>تحديث الطابعات</span>
            </button>
            <div className="flex items-center gap-2 text-gray-900">
              <Printer className="w-5 h-5 text-[#2e5b9f]" />
              <div>
                <h3 className="font-bold text-base">طابعات الكاشير المخصصة (Desktop)</h3>
                <p className="text-[11px] text-gray-500">
                  حدد طابعات الكاشير المخصصة لهذا الجهاز لطباعة الفاتورة تلقائياً بدون ظهور أي Dialog
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {availablePrinters.length === 0 ? (
              <div className="py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
                {isLoadingPrinters ? 'جاري البحث عن الطابعات المتصلة…' : 'لم يتم العثور على أي طابعات في نظام التشغيل.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availablePrinters.map((printer, index) => {
                  const isConfigured = configuredPrinters.includes(printer.name);
                  // إذا كانت حالة الطابعة 0 أو غير معرفة فهي جاهزة/متصلة
                  const isOnline = printer.status === 0 || printer.status === undefined;
                  return (
                    <div
                      key={printer.name}
                      onClick={() => togglePrinter(printer.name)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isConfigured
                          ? 'border-[#2e5b9f] bg-blue-50/40 ring-1 ring-[#2e5b9f]/20'
                          : 'border-gray-200 bg-white hover:bg-gray-50/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isConfigured}
                          onChange={() => {}} // يتم التغيير عبر onClick الحاوية
                          className="w-4 h-4 text-[#2e5b9f] rounded focus:ring-0 cursor-pointer pointer-events-none"
                        />
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isOnline ? 'الحالة: متصلة' : 'الحالة: غير متصلة أو مشغولة'}
                        </span>
                      </div>

                      <div className="text-right flex-1 min-w-0">
                        <div className="flex items-center justify-end gap-1.5">
                          {printer.isDefault && (
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded">
                              افتراضية النظام
                            </span>
                          )}
                          <span className="text-sm font-bold text-gray-900 truncate">
                            {index + 1}. {printer.displayName || printer.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono block truncate">
                          {printer.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2e5b9f] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  عدد طابعات الكاشير المحددة حالياً: {configuredPrinters.length} طابعة
                </p>
                <p className="text-[11px] text-blue-800">
                  عند الضغط على "طباعة الفاتورة"، تُرسل الفاتورة مباشرةً إلى جميع الطابعات المحددة أعلاه في نفس الوقت دون ظهور نافذة Windows Print Dialog نهائياً. لن تُرسل الفاتورة لأي طابعة أخرى غير محددة (مثل OneNote أو PDF).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs">
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-gray-100 text-gray-900">
          <User className="w-5 h-5 text-[#2e5b9f]" />
          <h3 className="font-bold text-base">بيانات المدير / المستخدم الحالي</h3>
        </div>

        <form noValidate onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="الاسم الكامل *"
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value);
                if (profileErrors.userName) setProfileErrors({ ...profileErrors, userName: undefined });
              }}
              error={profileErrors.userName}
              required
            />
            <Input
              label="البريد الإلكتروني (غير قابل للتعديل)"
              value={user?.email || ''}
              disabled
              className="bg-gray-50 opacity-80"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              isLoading={isUpdating}
              className="bg-[#2e5b9f]"
            >
              تحديث بياناتي
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};