import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { User, UserRole } from '../types';
import { ApiClient } from '../services/api/apiClient';
import { authService, userService } from '../services/authService';
import { useNotification } from './NotificationContext';

interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  refreshUserProfile: () => Promise<void>;
  updateProfile: (data: { userName?: string; phone?: string; address?: string }) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { showToast, showError } = useNotification();
  // هل كان فيه جلسة نشطة؟ (عشان رسالة انتهاء الجلسة متتكررش)
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    wasAuthenticatedRef.current = !!user;
  }, [user]);

  const loadCurrentUser = useCallback(async () => {
    const token = ApiClient.getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await userService.getMe();
      if (res.success && res.data) {
        setUser(res.data);
      }
    } catch {
      ApiClient.clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();

    const handleUnauthorized = () => {
      setUser(null);
      // اعرض رسالة انتهاء الجلسة مرة واحدة فقط عند فقدان جلسة فعلاً نشطة،
      // مش على كل طلب 401 بيحصل واليوزر خارج أصلاً (ده كان سبب تكرار الرسالة)
      if (wasAuthenticatedRef.current) {
        wasAuthenticatedRef.current = false;
        showToast('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً', 'error');
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [loadCurrentUser, showToast]);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      setIsLoading(true);
      const res = await authService.login(email, password);
      if (res.success && res.tokens) {
        ApiClient.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        let loggedInUser: User | null = null;
        if (res.data) {
          loggedInUser = res.data;
          setUser(res.data);
        } else {
          // ✅ الـ Backend أعاد التوكنز فقط — نجلب بيانات المستخدم ونرجّعها
          // (كانت العيب هنا: كنا بنجلب البيانات لكن بنرجع null فيظهر خطأ الدخول رغم نجاحه)
          try {
            const me = await userService.getMe();
            if (me.success && me.data) {
              loggedInUser = me.data;
              setUser(me.data);
            }
          } catch {
            // تجاهل — loadCurrentUser في الـ effect سيتكفل بالمزامنة
          }
        }
        showToast('تم تسجيل الدخول بنجاح');
        return loggedInUser;
      }
      return null;
    } catch (err: any) {
      showError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    showToast('تم تسجيل الخروج بنجاح', 'info');
  };

  const refreshUserProfile = async () => {
    try {
      const res = await userService.getMe();
      if (res.success && res.data) {
        setUser(res.data);
      }
    } catch (err) {
      console.error('Failed to refresh profile', err);
    }
  };

  const updateProfile = async (data: { userName?: string; phone?: string; address?: string }): Promise<boolean> => {
    try {
      const res = await userService.updateMe(data);
      if (res.success && res.data) {
        setUser(res.data);
        showToast('تم تحديث البيانات بنجاح');
        return true;
      }
      return false;
    } catch (err: any) {
      showError(err);
      return false;
    }
  };

  const isAdmin = user?.roleType === 'admin';
  const isCashier = user?.roleType === 'cashier';
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.roleType || null,
        isAuthenticated,
        isAdmin,
        isCashier,
        isLoading,
        login,
        logout,
        refreshUserProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
