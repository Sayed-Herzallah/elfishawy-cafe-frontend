import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Coffee, Eye, EyeOff } from 'lucide-react';
import { usePageSEO } from '../seo/usePageSEO';
import { PAGE_SEO } from '../seo/seoConfig';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // صفحة خاصة بفريق العمل — مستبعدة من الفهرسة
  usePageSEO({ meta: PAGE_SEO.login });

  const { login, loginError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitted(true);

    if (!email || !password) {
      setErrorMessage('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setIsLoading(true);
    const loggedInUser = await login(email, password);
    setIsLoading(false);

    if (loggedInUser) {
      // ✅ التحويل حسب الدور الفعلي من الـ Backend — وليس محتوى الإيميل
      if (loggedInUser.roleType === 'cashier') {
        navigate('/pos');
      } else {
        navigate('/admin');
      }
    } else {
      setErrorMessage(loginError || 'لم يكتمل تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#fcfaf7] text-[#1c1917] font-sans antialiased">
      {/* Left Brand Panel (Figma login.png) */}
      <div className="hidden md:flex md:w-5/12 bg-[#2e5b9f] flex-col items-center justify-center p-12 text-white relative overflow-hidden">
        {/* Circular Stamp Graphic — هوية متحركة: حلقتان تدوران باتجاهين + فنجان يطفو */}
        <div className="relative w-72 h-72 flex items-center justify-center">
          {/* هالة ضوئية تتنفس خلف الفنجان */}
          <div className="absolute inset-8 rounded-full bg-white/10 blur-2xl animate-brand-glow" />

          {/* الحلقة المتقطعة الخارجية — دوران بطيء مستمر */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/40 animate-brand-spin" />

          {/* الحلقة الداخلية المنقطة — دوران عكسي أبطأ لعمق بصري */}
          <div className="absolute inset-5 rounded-full border border-dotted border-white/25 animate-brand-spin-reverse" />

          {/* المحتوى: الفنجان يطفو والاسم يتنفس */}
          <div className="relative flex flex-col items-center animate-brand-float">
            <Coffee className="w-16 h-16 text-white drop-shadow-lg" />
            <div className="text-xs font-bold mt-3 font-mono tracking-[0.28em] animate-brand-breathe">
              EL-FISHAWY
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 text-center text-xs text-blue-200/80 font-mono">
          Elfishawy Cafe Management & POS System
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100/90 p-8 md:p-10 text-right">
          <div className="mb-8">
            <h1 className="text-3xl font-bold font-arabic-heading text-gray-900 mb-2">
              مرحبًا بعودتك
            </h1>
            <p className="text-xs text-gray-500 leading-relaxed">
              الرجاء إدخال بيانات الاعتماد الخاصة بك للوصول إلى السجل الخاص بك.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                label="البريد الإلكتروني *"
                type="email"
                dir="ltr"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={isSubmitted && !email ? 'البريد الإلكتروني مطلوب' : ''}
                isSubmitted={isSubmitted}
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
              </div>
              <Input
                label="كلمة المرور *"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={isSubmitted && !password ? 'كلمة المرور مطلوبة' : ''}
                isSubmitted={isSubmitted}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                }
                required
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                className="w-full bg-[#2e5b9f] hover:bg-[#244b85] text-white font-bold py-3 text-sm rounded-xl shadow-md"
              >
                تسجيل الدخول
              </Button>
            </div>
          </form>

          <div className="mt-8 text-center pt-2">
            <Link to="/" className="text-sm font-bold text-[#2e5b9f] hover:text-[#244b85] transition flex items-center justify-center gap-1">
              <span>← العودة إلى الصفحة الرئيسية</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
