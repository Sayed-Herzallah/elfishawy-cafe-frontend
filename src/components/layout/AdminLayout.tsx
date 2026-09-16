import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  Coffee,
  Boxes,
  ShoppingBag,
  ReceiptText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
  RefreshCw,
} from "lucide-react";

export const AdminLayout: React.FC = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const handleManualCheckUpdate = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      if (window.electronAPI?.checkFrontendUpdate) {
        const res = await window.electronAPI.checkFrontendUpdate();
        if (res && res.hasUpdate && res.ready) {
          window.location.reload();
        } else {
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleConfirmedLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate("/login", { replace: true });
  };

  const groupedNavItems = [
    {
      title: "العام والتقارير",
      items: [
        { to: "/admin", label: "الرئيسية والإحصائيات", icon: <LayoutDashboard className="w-4 h-4" />, exact: true },
        { to: "/admin/reports", label: "التقارير المالية", icon: <BarChart3 className="w-4 h-4" /> },
      ]
    },
    {
      title: "إدارة العمليات",
      items: [
        { to: "/admin/products", label: "المنيو والمنتجات", icon: <Coffee className="w-4 h-4" /> },
        { to: "/admin/inventory", label: "المخزون والمواد الخام", icon: <Boxes className="w-4 h-4" /> },
        { to: "/admin/sales", label: "المبيعات والطلبات", icon: <ShoppingBag className="w-4 h-4" /> },
        { to: "/admin/expenses", label: "المصروفات والمشتريات", icon: <ReceiptText className="w-4 h-4" /> },
      ]
    },
    {
      title: "التهيئة والتشغيل",
      items: [
        { to: "/admin/settings", label: "إعدادات الحساب", icon: <Settings className="w-4 h-4" /> },
        { to: "/pos", label: "شاشة الكاشير (POS)", icon: <Store className="w-4 h-4" /> },
      ]
    }
  ];

  const getPageTitle = () => {
    for (const group of groupedNavItems) {
      const item = group.items.find((n) =>
        n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)
      );
      if (item) return item.label;
    }
    return "لوحة التحكم";
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2] text-gray-800 antialiased font-sans overflow-x-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed top-0 right-0 z-40 h-full w-60 bg-white border-l border-gray-200/80",
          "flex flex-col p-4 shadow-lg",
          "transition-transform duration-200 ease-in-out",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {/* Logo Brand Header */}
          <div className="flex items-center justify-between pb-4 mb-3 border-b border-gray-100">
            <button
              className="lg:hidden p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
              onClick={() => setSidebarOpen(false)}
              aria-label="إغلاق القائمة"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 justify-end flex-1">
              <h1 className="font-bold text-base text-gray-900 leading-tight font-arabic-heading">
                مقهى الفيشاوي
              </h1>
              <div className="w-9 h-9 rounded-xl bg-[#2e5b9f] flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                ☕
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-4 text-right flex-1">
            {groupedNavItems.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 tracking-wider px-2 uppercase block">
                  {group.title}
                </span>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.exact
                      ? location.pathname === item.to
                      : location.pathname.startsWith(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setSidebarOpen(false)}
                        className={[
                          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition duration-150",
                          isActive
                            ? "bg-[#2e5b9f] text-white shadow-sm shadow-[#2e5b9f]/20"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                        ].join(" ")}
                      >
                        <span className={isActive ? "text-white" : "text-gray-400"}>{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Professional Logout Footer */}
        <div className="pt-3 border-t border-gray-100 shrink-0 mt-4">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold text-[#9f1239] bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer border border-rose-100"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <div className="lg:pr-60 min-h-screen flex flex-col min-w-0">
        <header className="bg-white sticky top-0 z-20 border-b border-gray-200/80 px-4 py-3 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-600 rounded-xl hover:bg-gray-100 transition cursor-pointer shrink-0"
              aria-label="فتح القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-arabic-heading font-bold text-gray-900 text-sm truncate">
              {getPageTitle()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualCheckUpdate}
              disabled={isCheckingUpdate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#2e5b9f] font-bold text-xs border border-blue-200 transition cursor-pointer whitespace-nowrap shadow-2xs"
              title="مزامنة وتحديث فوري مع أحدث نسخة من المنصة"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'جاري المزامنة...' : 'تحديث وتزامن فوري'}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 w-full min-w-0">
          <div className="max-w-[1400px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm p-6 z-10 text-right">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-rose-50 text-[#9f1239] mx-auto mb-3 border border-rose-100">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold font-arabic-heading text-gray-900 text-center">
              تأكيد تسجيل الخروج
            </h3>
            <p className="text-xs text-gray-500 text-center mt-1.5 leading-relaxed">
              هل أنت متأكد من تسجيل الخروج من لوحة الإدارة؟
            </p>
            <div className="mt-5 space-y-2">
              <button onClick={handleConfirmedLogout} className="w-full bg-[#9f1239] hover:bg-[#881337] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-2xs cursor-pointer">
                نعم، خروج
              </button>
              <button onClick={() => setShowLogoutConfirm(false)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
