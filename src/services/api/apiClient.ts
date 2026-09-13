import { ApiResponse } from '../../types';

// في dev mode: استخدم '' عشان الطلبات تروح للـ Vite proxy (اللي بيعملها forward للـ Vercel)
// في production (Vercel): استخدم الـ URL الحقيقي للـ backend
const BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  ((import.meta as any).env?.DEV ? '' : 'https://elfishawy-cafe-server.vercel.app');

// مكشوفة عشان services تانية تستخدمها (زي logout)
export const API_BASE_URL = BASE_URL;

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'ef_access_token',
  REFRESH_TOKEN: 'ef_refresh_token',
  ACTIVE_USER: 'ef_active_user',
};

export class ApiClient {
  // Single-flight refresh: لو أكتر من طلب واخد 401 في نفس اللحظة، يتعمل refresh واحد بس
  private static refreshPromise: Promise<boolean> | null = null;
  // منع تكرار إشعار انتهاء الجلسة: مرة واحدة كحد أقصى كل 30 ثانية
  private static lastUnauthorizedAt = 0;

  // عدّاد الجلسات: بيزيد مع كل logout عشان يلغي أي refresh/retry جاري
  private static sessionEpoch = 0;

  public static getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  public static getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  public static setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    // جلسة جديدة: اسمح بإشعار انتهاء الجلسة مرة أخرى لو حصلت لاحقاً
    ApiClient.lastUnauthorizedAt = 0;
  }

  public static clearTokens() {
    // إلغاء أي عملية refresh أو retry جارية فوراً (عشان التوكن ميرجعش بعد الخروج)
    ApiClient.sessionEpoch++;
    ApiClient.refreshPromise = null;
    ApiClient.lastUnauthorizedAt = 0;
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
  }

  public static async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${BASE_URL}${endpoint}`;
    const token = ApiClient.getAccessToken();

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // BACKEND RULE: Send raw token with NO 'Bearer ' prefix
    if (token && !headers['authorization']) {
      headers['authorization'] = token;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const sessionEpoch = ApiClient.sessionEpoch;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // 401 Unauthorized -> Attempt token refresh (single-flight للطلبات المتوازية)
      if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refreshToken') {
        const refreshed = await ApiClient.refreshAccessToken();
        // لو حصل logout أثناء الطلب، ارفض التجديد فوراً
        if (sessionEpoch !== ApiClient.sessionEpoch) {
          throw { success: false, message: 'Unauthorized' };
        }
        if (refreshed) {
          headers['authorization'] = ApiClient.getAccessToken() || '';
          const retryRes = await fetch(url, { ...options, headers });
          return ApiClient.parseResponse(retryRes);
        } else {
          ApiClient.clearTokens();
          ApiClient.notifyUnauthorized();
          throw { success: false, message: 'Unauthorized' };
        }
      }

      return ApiClient.parseResponse(response);
    } catch (networkError: any) {
      console.error('API Request Error:', networkError);
      throw networkError;
    }
  }

  /**
   * قراءة استجابة الخادم بأمان:
   * - لو رجّع JSON عادي → نستخدمه زي ما هو
   * - لو رجّع نص/HTML (مثل "Request Entity Too Large" من Vercel أو صفحة خطأ)
   *   → نرمي رسالة عربية واضحة بدل خطأ "Unexpected token" المحيّر
   */
  private static async parseResponse(response: Response): Promise<any> {
    const raw = await response.text();
    let data: any = null;
    if (raw && raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null; // استجابة مش JSON (خطأ نصي من البروكسي أو الخادم)
      }
    }

    if (response.ok) {
      return data ?? { success: true, data: null };
    }

    // الاستجابة JSON فيها رسالة واضحة بالفعل → نرميها كما هي
    if (
      data &&
      (typeof data.message === 'string' ||
        typeof data.error === 'string' ||
        typeof data.detail === 'string')
    ) {
      throw data;
    }

    // وإلا: رسالة ودّية حسب كود الحالة (خصوصاً 413 = الصورة كبيرة)
    const statusMessages: Record<number, string> = {
      400: 'طلب غير صالح — تأكد من البيانات المدخلة',
      401: 'انتهت الجلسة — سجّل الدخول من جديد',
      403: 'لا تملك صلاحية تنفيذ هذا الإجراء',
      404: 'العنصر المطلوب غير موجود',
      409: 'تعارض في البيانات (قد يكون العنصر موجوداً مسبقاً)',
      413: 'حجم الصورة أو الطلب كبير جداً على الخادم — استخدم صورة أصغر أو اضغطها وحاول تاني',
      415: 'نوع الملف غير مدعوم — استخدم صورة JPG أو PNG',
      422: 'البيانات المدخلة غير مكتملة أو غير صحيحة',
      429: 'أرسلت طلبات كتير في وقت قصير — حاول بعد قليل',
      500: 'خطأ في الخادم — حاول مرة تانية بعد قليل',
      502: 'الخادم غير متاح حالياً — حاول مرة تانية',
      503: 'الخدمة مشغولة حالياً — حاول مرة تانية',
      504: 'الخادم استغرق وقتاً أطول من المتوقع — حاول مرة تانية',
    };

    throw {
      success: false,
      status: response.status,
      message:
        statusMessages[response.status] ||
        `الخادم رجّع استجابة غير متوقعة (${response.status}) — حاول مرة تانية`,
    };
  }

  /** إشعار انتهاء الجلسة: مرة واحدة كحد أقصى كل 30 ثانية بدل ما يتكرر مع كل طلب polling */
  private static notifyUnauthorized() {
    const now = Date.now();
    if (now - ApiClient.lastUnauthorizedAt < 30_000) return;
    ApiClient.lastUnauthorizedAt = now;
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  /** Single-flight: الطلبات اللي بتاخد 401 في نفس اللحظة بتتقاسم نفس عملية الـ refresh */
  private static refreshAccessToken(): Promise<boolean> {
    if (!ApiClient.refreshPromise) {
      ApiClient.refreshPromise = ApiClient.tryRefreshToken().finally(() => {
        ApiClient.refreshPromise = null;
      });
    }
    return ApiClient.refreshPromise;
  }

  private static async tryRefreshToken(): Promise<boolean> {
    const epoch = ApiClient.sessionEpoch;
    const refreshToken = ApiClient.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${BASE_URL}/auth/refreshToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;

      // استجابة مرنة: { accessToken } أو { tokens: { accessToken } } أو { data: { accessToken } }
      const data = await res.json().catch(() => null);
      const accessToken: string | undefined =
        data?.accessToken || data?.tokens?.accessToken || data?.data?.accessToken;

      if (accessToken) {
        // متخزنش توكن جديد لو عملت logout أثناء الـ refresh
        if (epoch !== ApiClient.sessionEpoch) return false;
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
