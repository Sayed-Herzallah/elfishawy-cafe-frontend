import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LogOut,
  ShoppingCart,
  Boxes,
  ReceiptText,
  Menu,
  X,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';

export const CashierLayout: React.FC = () => {
  const { logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; message: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.onFrontendUpdateReady) {
      const unsub = window.electronAPI.onFrontendUpdateReady((data) => {
        setUpdateInfo(data);
      });
      return unsub;
    }
  }, []);

  const handleApplyUpdate = async () => {
    if (window.electronAPI?.applyFrontendUpdate) {
      await window.electronAPI.applyFrontendUpdate();
    } else {
      window.location.reload();
    }
  };

  const handleConfirmedLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate('/login', { replace: true });
  };

  // 🔐 زر العودة لنظام الإدارة — يظهر للادمن فقط (يتحقق من الصلاحية)
  const goAdmin = () => {
    setSidebarOpen(false);
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2] text-gray-900 antialiased font-sans overflow-x-hidden">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile/Tablet Navigation Drawer */}
      <aside
        className={`
          fixed top-0 right-0 z-40 h-full w-60 bg-white border-l border-gray-200/80
          flex flex-col justify-between p-4 shadow-lg transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:hidden
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div>
          <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-gray-100">
            <button
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
              onClick={() => setSidebarOpen(false)}
              aria-label="إغلاق القائمة"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 justify-end flex-1">
              <h1 className="font-bold text-sm text-gray-900 leading-tight font-arabic-heading">
                مقهى الفيشاوي
              </h1>
              <div className="w-8 h-8 rounded-xl bg-[#2e5b9f] flex items-center justify-center text-white font-bold text-sm shadow-2xs shrink-0">
                ☕
              </div>
            </div>
          </div>

          <nav className="space-y-1 text-right">
            <NavLink
              to="/pos"
              end
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <ShoppingCart className="w-4 h-4 text-gray-400" />
              <span className="truncate">نقطة البيع</span>
            </NavLink>
            <NavLink
              to="/pos/inventory"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <Boxes className="w-4 h-4 text-gray-400" />
              <span className="truncate">المخزون</span>
            </NavLink>
            <NavLink
              to="/pos/expenses"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <ReceiptText className="w-4 h-4 text-gray-400" />
              <span className="truncate">المشتريات</span>
            </NavLink>
          </nav>
        </div>

        <div className="pt-3 border-t border-gray-100 space-y-2">
          {isAdmin && (
            <button
              onClick={goAdmin}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-white bg-[#2e5b9f] hover:bg-[#244b85] rounded-xl transition cursor-pointer shadow-2xs"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>الإدارة</span>
            </button>
          )}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-[#9f1239] bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer border border-rose-250"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Top Bar for Desktop and Mobile Header */}
      <header className="bg-white border-b border-gray-200/80 px-4 py-3 flex items-center justify-between gap-4 shadow-2xs sticky top-0 z-20">
        {/* Brand Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-bold text-base md:text-lg font-arabic-heading text-gray-900 tracking-tight whitespace-nowrap">
            مقهى الفيشاوي (إصدار OTA 1.1.0 ⚡)
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#2e5b9f] text-white flex items-center justify-center font-bold text-sm shadow-2xs">
            ☕
          </div>
        </div>

        {/* Center Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#f0ebe1] p-1 rounded-xl border border-gray-200/70 text-xs">
          <NavLink
            to="/pos"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-bold transition whitespace-nowrap ${
                isActive
                  ? 'bg-[#2e5b9f] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }`
            }
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>نقطة البيع</span>
          </NavLink>

          <NavLink
            to="/pos/inventory"
            className={({ isActive }) =>
              `flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-bold transition whitespace-nowrap ${
                isActive
                  ? 'bg-[#2e5b9f] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }`
            }
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>المخزون</span>
          </NavLink>

          <NavLink
            to="/pos/expenses"
            className={({ isActive }) =>
              `flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-bold transition whitespace-nowrap ${
                isActive
                  ? 'bg-[#2e5b9f] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }`
            }
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span>المشتريات</span>
          </NavLink>
        </nav>

        {/* Left Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-600 rounded-xl hover:bg-gray-100 transition cursor-pointer"
            aria-label="فتح القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={goAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2e5b9f] hover:bg-[#244b85] text-white font-bold text-xs transition cursor-pointer whitespace-nowrap shadow-2xs"
                title="العودة لنظام الإدارة — متاح للادمن فقط"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>الإدارة</span>
              </button>
            )}

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#9f1239] font-bold text-xs border border-rose-200 transition cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Optional In-App Hot-Update Banner */}
      {updateInfo && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-4 py-2 flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
            <span className="font-bold">
              يوجد تحديث جديد للواجهة ({updateInfo.version})! تم تحميله تلقائياً.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyUpdate}
              className="bg-white text-emerald-800 hover:bg-emerald-50 px-3 py-1 rounded-lg font-bold transition shadow-2xs cursor-pointer text-xs"
            >
              تطبيق التحديث الآن ⚡
            </button>
            <button
              onClick={() => setUpdateInfo(null)}
              className="text-white/80 hover:text-white p-1 rounded transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Screen Body */}
      <main className="p-4 md:p-6 w-full min-w-0">
        <div className="max-w-[1400px] mx-auto w-full">
          <Outlet />
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm p-6 z-10 text-right">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-rose-50 text-[#9f1239] mx-auto mb-3 border border-rose-100">
              <LogOut className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold font-arabic-heading text-gray-900 text-center">
              تأكيد تسجيل الخروج
            </h3>

            <p className="text-xs text-gray-500 text-center mt-1.5 leading-relaxed">
              هل أنت متأكد من رغبتك في تسجيل الخروج؟ سيتم إغلاق الجلسة فوراً.
            </p>

            <div className="mt-5 space-y-2">
              <button
                onClick={handleConfirmedLogout}
                className="w-full bg-[#9f1239] hover:bg-[#881337] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-2xs cursor-pointer"
              >
                نعم، خروج
              </button>

              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
