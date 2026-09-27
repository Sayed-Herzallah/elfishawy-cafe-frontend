import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Download, CheckCircle2, FileSpreadsheet, Printer } from 'lucide-react';
import { Button } from './Button';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportPDF: () => void;
  onExportCSV: () => void;
  title?: string;
  periodLabel?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExportPDF,
  onExportCSV,
  title = 'تصدير التقرير المالي',
  periodLabel = 'الفترة الحالية',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv'>('pdf');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedFormat === 'pdf') {
      onClose();
      // Let React remove the dialog before html2canvas captures the report.
      window.setTimeout(() => void onExportPDF(), 100);
    } else {
      onExportCSV();
      onClose();
    }
  };

  return createPortal((
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md p-6 z-10 text-right animate-in fade-in zoom-in-95 duration-150 font-sans" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold font-arabic-heading text-gray-900 flex items-center gap-2">
              <Download className="w-5 h-5 text-[#2e5b9f]" />
              {title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              حدد الصيغة المفضلة لتصدير وحفظ بيانات {periodLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selection Cards */}
        <div className="py-5 space-y-3">
          {/* PDF Option (Preferred / Highlighted) */}
          <div
            onClick={() => setSelectedFormat('pdf')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
              selectedFormat === 'pdf'
                ? 'border-rose-500 bg-rose-50/50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-gray-900">مستند PDF رسمي</span>
                  
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  ملخص منسق في صفحة واحدة جاهز للطباعة أو الحفظ كملف PDF
                </p>
              </div>
            </div>

            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedFormat === 'pdf' ? 'border-rose-600 bg-rose-600 text-white' : 'border-gray-300'
            }`}>
              {selectedFormat === 'pdf' && <CheckCircle2 className="w-4 h-4" />}
            </div>
          </div>

          {/* Excel / CSV Option */}
          <div
            onClick={() => setSelectedFormat('csv')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
              selectedFormat === 'csv'
                ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="text-right">
                <span className="font-bold text-sm text-gray-900 block">جدول إكسل / CSV</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  ملف بيانات جدولية للأرقام والمؤشرات متوافق مع Excel
                </p>
              </div>
            </div>

            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedFormat === 'csv' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300'
            }`}>
              {selectedFormat === 'csv' && <CheckCircle2 className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
          <Button
            onClick={handleConfirm}
            variant="primary"
            className="flex-1 bg-[#2e5b9f] hover:bg-[#244b85] text-white font-bold py-3 rounded-xl shadow-xs"
            leftIcon={<Download className="w-4 h-4 ml-1.5" />}
          >
            تأكيد التصدير ({selectedFormat.toUpperCase()})
          </Button>

          <Button
            onClick={onClose}
            variant="outline"
            className="py-3 px-4 rounded-xl text-gray-600 text-xs"
          >
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  ), document.body);
};
